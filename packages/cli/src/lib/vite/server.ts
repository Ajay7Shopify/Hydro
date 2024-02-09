import {type HMRChannel, type HMRPayload, type ViteDevServer} from 'vite';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import type {ServerResponse} from 'node:http';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {Readable} from 'node:stream';
import {createFileReadStream} from '@shopify/cli-kit/node/fs';
import {Miniflare, NoOpLog, Request, type Response} from 'miniflare';
import {WebSocket, WebSocketServer} from 'ws';
import {
  H2O_BINDING_NAME,
  createLogRequestEvent,
  handleDebugNetworkRequest,
} from '../request-events.js';
import {
  OXYGEN_HEADERS_MAP,
  SUBREQUEST_PROFILER_ENDPOINT,
  logRequestLine,
} from '../mini-oxygen/common.js';
import {
  PRIVATE_WORKERD_INSPECTOR_PORT,
  OXYGEN_WORKERD_COMPAT_PARAMS,
} from '../mini-oxygen/workerd.js';
import {findPort} from '../find-port.js';
import {createInspectorConnector} from '../mini-oxygen/workerd-inspector.js';
import {MiniOxygenOptions} from '../mini-oxygen/types.js';

import type {ViteEnv} from './client.js';
const clientPath = fileURLToPath(new URL('./client.js', import.meta.url));

const AsyncFunction = async function () {}.constructor as typeof Function;
const fnDeclarationLineCount = (() => {
  const body = '/*code*/';
  const source = new AsyncFunction('a', 'b', body).toString();
  return source.slice(0, source.indexOf(body)).split('\n').length - 1;
})();

const PRIVATE_WORKERD_HMR_PORT = 9400;
const FETCH_MODULE_PATHNAME = '/__vite_fetch_module';
const WARMUP_PATHNAME = '/__vite_warmup';

const oxygenHeadersMap = Object.values(OXYGEN_HEADERS_MAP).reduce(
  (acc, item) => {
    acc[item.name] = item.defaultValue;
    return acc;
  },
  {} as Record<string, string>,
);

type MiniOxygenViteOptions = Pick<
  MiniOxygenOptions,
  'env' | 'debug' | 'inspectorPort'
> & {
  viteServer: ViteDevServer;
  publicUrl: URL;
  workerEntryFile: string;
};

export async function startMiniOxygenVite({
  viteServer,
  publicUrl,
  env,
  debug = false,
  inspectorPort,
  workerEntryFile,
}: MiniOxygenViteOptions) {
  const scriptPromise = readFile(clientPath, 'utf-8');
  const [publicInspectorPort, privateInspectorPort, privateHmrPort] =
    await Promise.all([
      findPort(inspectorPort),
      findPort(PRIVATE_WORKERD_INSPECTOR_PORT),
      findPort(PRIVATE_WORKERD_HMR_PORT),
    ]);

  const mf = new Miniflare({
    cf: false,
    verbose: false,
    log: new NoOpLog(),
    name: 'hydrogen',
    inspectorPort: privateInspectorPort,
    modules: true,
    modulesRoot: viteServer.config.root,
    script: await scriptPromise,
    scriptPath: path.join(viteServer.config.root, '_virtual-server-entry.js'),
    ...OXYGEN_WORKERD_COMPAT_PARAMS,
    bindings: {
      ...env,
      __VITE_ROOT: viteServer.config.root,
      __VITE_CODE_LINE_OFFSET: String(fnDeclarationLineCount),
      __VITE_RUNTIME_EXECUTE_URL: workerEntryFile,
      __VITE_FETCH_MODULE_URL: new URL(
        FETCH_MODULE_PATHNAME,
        publicUrl.origin,
      ).toString(),
      __VITE_HMR_URL: `http://localhost:${privateHmrPort}`,
      __VITE_WARMUP_URL: new URL(WARMUP_PATHNAME, publicUrl.origin).toString(),
    } satisfies Omit<ViteEnv, '__VITE_UNSAFE_EVAL'>,
    unsafeEvalBinding: '__VITE_UNSAFE_EVAL',
    serviceBindings: {
      [H2O_BINDING_NAME]: createLogRequestEvent({
        absoluteBundlePath: '', // TODO
      }),
    },
    handleRuntimeStdio(stdout, stderr) {
      // TODO: handle runtime stdio and remove inspector logs
    },
  });

  const wss = new WebSocketServer({host: 'localhost', port: privateHmrPort});

  mf.ready.then(() => {
    const hmrChannel = new WssHmrChannel();
    viteServer.hot.addChannel(hmrChannel);

    wss.on('connection', (ws) => {
      hmrChannel.clients.add(ws);
      ws.on('close', () => {
        hmrChannel.clients.delete(ws);
      });
    });

    const reconnect = createInspectorConnector({
      debug,
      sourceMapPath: '',
      absoluteBundlePath: '',
      privateInspectorPort,
      publicInspectorPort,
    });

    mf.dispatchFetch(new URL(WARMUP_PATHNAME, publicUrl)).catch(() => {});

    return reconnect();
  });

  viteServer.middlewares.use(
    FETCH_MODULE_PATHNAME,
    function h2HandleModuleFetch(req, res) {
      // This request comes from workerd. It is asking for the contents
      // of backend files. We need to fetch the file through Vite,
      // which transpiles/prepares the source code into valid JS, and
      // send it back so that workerd can evaluate/run it.

      const url = new URL(req.url!, publicUrl);
      const id = url.searchParams.get('id');
      const importer = url.searchParams.get('importer') ?? undefined;

      if (id) {
        res.setHeader('cache-control', 'no-store');
        res.setHeader('content-type', 'application/json');
        viteServer.ssrFetchModule(id, importer).then((ssrModule) => {
          res.end(JSON.stringify(ssrModule));
        });
      } else {
        res.statusCode = 400;
        res.end('Invalid request');
      }
    },
  );

  viteServer.middlewares.use(
    '/graphiql/customer-account.schema.json',
    function h2HandleGraphiQLCustomerSchema(req, res) {
      // This request comes from Hydrogen's GraphiQL.
      // Currently, the CAAPI schema is not available in the public API,
      // so we serve it from here.

      const require = createRequire(import.meta.url);
      const filePath = require.resolve(
        '@shopify/hydrogen/customer-account.schema.json',
      );

      res.writeHead(200, {'Content-Type': 'application/json'});
      createFileReadStream(filePath).pipe(res);
    },
  );

  viteServer.middlewares.use(
    SUBREQUEST_PROFILER_ENDPOINT,
    function h2HandleSubrequestProfilerEvent(req, res) {
      // This request comes from Hydrogen's Subrequest Profiler UI.

      const url = new URL(req.url ?? '/', publicUrl.origin);

      const webResponse = handleDebugNetworkRequest(
        new Request(url, {method: req.method}),
      );

      pipeFromWeb(webResponse, res);
    },
  );

  viteServer.middlewares.use(function h2HandleWorkerRequest(req, res) {
    // This request comes from the browser. At this point, Vite
    // tried to serve the request as a static file, but it didn't
    // find it in the project. Therefore, we assume this is a
    // request for a Remix route, and we forward it to workerd.

    const url = new URL(req.url ?? '/', publicUrl.origin);

    const webRequest = new Request(url, {
      method: req.method,
      headers: {
        'request-id': crypto.randomUUID(),
        ...oxygenHeadersMap,
        ...(req.headers as object),
      },
      body: req.headers['content-length'] ? Readable.toWeb(req) : undefined,
      duplex: 'half', // This is required when sending a ReadableStream as body
      redirect: 'manual', // Avoid consuming 300 responses here, return to browser
    });

    const startTimeMs = Date.now();

    mf.dispatchFetch(webRequest)
      .then((webResponse) => {
        pipeFromWeb(webResponse, res);

        logRequestLine(webRequest, {
          responseStatus: webResponse.status,
          durationMs: Date.now() - startTimeMs,
        });
      })
      .catch((error) => {
        console.error('Error during evaluation:', error);
        res.writeHead(500);
        res.end();
      });
  });

  return async () => {
    await mf.dispose();
    await new Promise<void>((resolve, reject) =>
      wss.close((err) => (err ? reject(err) : resolve())),
    );
  };
}

function pipeFromWeb(webResponse: Response, res: ServerResponse) {
  res.writeHead(
    webResponse.status,
    Object.fromEntries(webResponse.headers.entries()),
  );

  if (webResponse.body) {
    Readable.fromWeb(webResponse.body).pipe(res);
  } else {
    res.end();
  }
}

class WssHmrChannel implements HMRChannel {
  name = 'WssHmrChannel';
  clients = new Set<WebSocket>();

  listen(): void {}
  close(): void {}
  on(_event: unknown, _listener: unknown): void {}
  off(_event: string, _listener: Function): void {}

  send(arg0: unknown, arg1?: unknown): void {
    let payload: HMRPayload;
    if (typeof arg0 === 'string') {
      payload = {
        type: 'custom',
        event: arg0,
        data: arg1,
      };
    } else {
      payload = arg0 as HMRPayload;
      if (payload.type === 'update') {
        // TODO: handle partial updates
        payload = {type: 'full-reload', path: '*'};
      }
    }

    this.clients.forEach((ws) => {
      ws.send(JSON.stringify(payload));
    });
  }
}