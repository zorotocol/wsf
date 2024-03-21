// <!--GAMFC-->version base on commit 43fad05dcdae3b723c53c226f8181fc5bd47223e, time is 2023-06-22 15:20:02 UTC<!--GAMFC-END-->.
// @ts-ignore
import {connect} from 'cloudflare:sockets';


export default {
	async fetch(request: Request, env: {HOST:string}, ctx: ExecutionContext) {
		try {
			const upgradeHeader = request.headers.get('Upgrade');
			if (!upgradeHeader || upgradeHeader !== 'websocket') {
				return new Response('', {status: 426});
			}
			return await proxyHandler(request,env.HOST);
		} catch (err: any) {
			return new Response(err.toString(), {status: 500});
		}
	},
};


/**
 *
 * @param {import("@cloudflare/workers-types").Request} request
 */
async function proxyHandler(request: Request, remoteAddress: string) {
	let remoteSocket;
	try {
		remoteSocket = connect(remoteAddress);
	} catch (err: any) {
		return new Response(`could not connect to ${remoteAddress}`, {
			status: 400,
		});
	}
	const [webSocketClient, webSocketServer] = Object.values(new WebSocketPair());
	webSocketServer.accept();
	remoteSocket.closed.finally(() => {
		webSocketClient.close();
	});
	webSocketClient.addEventListener('close', () => {
		remoteSocket.close()
	}, {once: true});
	const remoteWriter = remoteSocket.writable.getWriter()
	webSocketServer.addEventListener('message', (ev: MessageEvent) => {
		let data = ev.data;
		if (typeof data === 'string') {
			data = new TextEncoder().encode(ev.data as string);
		}
		remoteWriter.write(data).catch(() => {
			webSocketServer.close();
		});
	});
	remoteSocket.readable.pipeTo(new WritableStream({
		async write(chunk, controller) {
			webSocketServer.send(chunk)
		},
		close() {
			webSocketServer.close()
		},
		abort(reason) {
			webSocketServer.close()
		},
	})).catch(() => {
		webSocketServer.close()
	})
	return remoteSocket.opened.then(() => {
		return new Response(null, {status: 101, webSocket: webSocketClient,})
	}).catch((err) => {
		return new Response(err.toString(), {status: 400,})
	});

}

