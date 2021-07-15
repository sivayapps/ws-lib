//shared-worker.worker.js
//https://medium.com/@nsbarsukov/dedicated-and-shared-web-workers-in-angular-c3df473882f6
importScripts("https://unpkg.com/comlink/dist/umd/comlink.js");

clientIdGenerator = 0;

class WSSubscriptionRegistry {
  connections = new Map();
  subscriptions = new Map();

  registerClient(sharedWorkerClient) {
    this.connections.set(sharedWorkerClient.clientId, sharedWorkerClient);
  }

  subscribe(topicId, topicSubscription) {
    if (!this.subscriptions.has(topicId)) {
      this.subscriptions.set(topicId, new Map());
    }
    this.subscriptions.get(topicId).set(topicSubscription.clientId, topicSubscription);
  }

  unSubscribe(topicId, clientId) {
    this.subscriptions.get(topicId)?.delete(clientId);
  }

  getAllClientSubscriptions(clientId) {
    let subs = new Set();
    this.subscriptions.forEach((value) => {
      value.forEach(topicSubscription => {
        if(clientId === topicSubscription.clientId) {
          subs.add(topicSubscription.topicId);
        }
      })
    });
    return subs;
  }
}

subscriptionRegistry = new WSSubscriptionRegistry();

function sendMessageToAll(message) {
  console.log(`SharedWorker sendMessageToAll: ${message}`);
  subscriptionRegistry.subscriptions.forEach((value) => {
    value.forEach(topicSubscription => {
      topicSubscription.callback(`Message publish from SharedWorker for thread:${topicSubscription.topicId} : ${message}`);
      console.log(`SharedWorker sendMessage for topicID: ${topicSubscription.topicId}, ClientId: ${topicSubscription.clientId}`);
    })
  });
}

class WebSocketMessageChannel {
  constructor(clientId) {
    this.clientId = clientId;
  }

  sendMessage(message) {
    console.log(`SharedWorker sendMessage: ${message}`);
    sendMessageToAll(message);
  }

  subscribe(topicId, callback) {
    subscriptionRegistry.subscribe(topicId, new TopicSubscription(this.clientId, topicId, callback));
    console.log(`SharedWorker subscribe: ${topicId}`);
  }

  unSubscribe(topicId) {
    console.log(`SharedWorker unSubscribe: Topic: ${topicId}, ClientId: ${this.clientId}`);
    subscriptionRegistry.unSubscribe(topicId, this.clientId);
  }

  getAllClientSubscriptions() {
    return subscriptionRegistry.getAllClientSubscriptions(this.clientId);
  }

  //ping pong
}

class TopicSubscription {
  constructor(clientId, topicId, callback) {
    this.clientId = clientId;
    this.topicId = topicId;
    this.callback = callback;
  }
}

class SharedWorkerClient {
  constructor(port, clientId, webSocketMessageChannel) {
    this.port = port;
    this.clientId = clientId;
    this.webSocketMessageChannel = webSocketMessageChannel;
  }
}

console.log(`SharedWorker started---`);
// onconnect = function(e) {
//   var port = e.ports[0];
//
//   connections.push(port);
//   port.onmessage = function(e) {
//     console.log(`SharedWorker onMessage---`);
//     var workerResult = 'Result: ' + (e.data[0] * e.data[1]);
//     port.postMessage(workerResult);
//   }
//
// }
onconnect = connectEvent => {
  clientIdGenerator++;
  console.log(`SharedWorker onConnect--- ${clientIdGenerator}`);
  const port = connectEvent.ports[0];
  const wsChannel = new WebSocketMessageChannel(clientIdGenerator);
  const sharedWorkerClient = new SharedWorkerClient(port, clientIdGenerator, wsChannel);
  subscriptionRegistry.registerClient(sharedWorkerClient);
  // connections.push(port);
  Comlink.expose(wsChannel, port);

  // port.onmessage = messageEvent => {
  //   console.log(`SharedWorker onMessage: ${messageEvent.data}`);
  //   connections.forEach(connection => {
  //     connection.postMessage(messageEvent.data);
  //   });
  // }
}
console.log(`SharedWorker Loaded---`);
