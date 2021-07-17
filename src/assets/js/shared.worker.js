//shared-worker.worker.js
//https://medium.com/@nsbarsukov/dedicated-and-shared-web-workers-in-angular-c3df473882f6
importScripts("https://unpkg.com/comlink/dist/umd/comlink.js");

clientIdGenerator = 0;
class STOMPMessageChannel {

  unSubscribe(topicId, clientId) {
    console.log(`Websocket unSubscribe: Topic: ${topicId}, ClientId: ${clientId}`);
  }

  subscribe(subscription) {
    console.log(`Websocket subscribe: Topic: ${subscription.topicId}, ClientId: ${subscription.clientId}`);
  }

}
stompMessageChannel = new STOMPMessageChannel();

class WSSubscriptionRegistry {
  connections = new Map();
  subscriptions = new Map();

  registerClient(sharedWorkerClient) {
    this.connections.set(sharedWorkerClient.clientId, sharedWorkerClient);
  }

  subscribe(topicId, topicSubscription) {
    if (!this.subscriptions.has(topicId)) {
      this.subscriptions.set(topicId, new Map());
      stompMessageChannel.subscribe(topicSubscription);
    }
    this.subscriptions.get(topicId).set(topicSubscription.clientId, topicSubscription);
  }

  unSubscribe(topicId, clientId) {
    let unsubscribed = this.subscriptions.get(topicId)?.delete(clientId);
    if(unsubscribed && this.subscriptions.get(topicId)?.size === 0) {
      this.subscriptions.delete(topicId)
      console.log(`SharedWorker Websocket unSubscribe:  ## No More Subscriptions for Topic: ${topicId}`);
      stompMessageChannel.unSubscribe(topicId, clientId);
    }
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

  closeClient(clientId) {
    this.connections.delete(clientId);
    let topicsSet = this.subscriptions.keys()
    topicsSet.forEach((topicId) => {
      subscriptionRegistry.unSubscribe(topicId, this.clientId);
    });
  }
}

subscriptionRegistry = new WSSubscriptionRegistry();

function sendMessageToAllSubscribers(message) {
  console.log(`SharedWorker sendMessageToAll: ${JSON.stringify(message)}`);
  subscriptionRegistry.subscriptions.forEach((value) => {
    value.forEach(topicSubscription => {
      if(message.topicId === topicSubscription.topicId || message.topicId === 'all') {
        topicSubscription.callback(message);
        // console.log(`SharedWorker sentMessage for topicID: ${topicSubscription.topicId}, ClientId: ${topicSubscription.clientId}`);
      }
    })
  });
}

class WebSocketMessageChannel {
  constructor(clientId) {
    this.clientId = clientId;
  }

  sendMessage(message) {
    console.log(`SharedWorker sendMessage: ${JSON.stringify(message)}`);
    if(message.topicId === 'healthCheck') {
      subscriptionRegistry.subscriptions.get(message.topicId)?.get(this.clientId)?.callback({topicId: message.topicId, data: 'pong'});
    } else {
      sendMessageToAllSubscribers(message);
    }
  }

  subscribe(topicId, callback) {
    subscriptionRegistry.subscribe(topicId, new TopicSubscription(this.clientId, topicId, callback));
    console.log(`SharedWorker subscribe: ${topicId}`);
    return subscriptionRegistry.getAllClientSubscriptions(this.clientId);
  }

  unSubscribe(topicId) {
    console.log(`SharedWorker unSubscribe: Topic: ${topicId}, ClientId: ${this.clientId}`);
    subscriptionRegistry.unSubscribe(topicId, this.clientId);
    return subscriptionRegistry.getAllClientSubscriptions(this.clientId);
  }

  getAllClientSubscriptions() {
    return subscriptionRegistry.getAllClientSubscriptions(this.clientId);
  }

  close() {
    console.log(`Page Closed for ClientId: ${this.clientId}`);
    subscriptionRegistry.closeClient(this.clientId)
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
onconnect = connectEvent => {
  clientIdGenerator++;
  console.log(`SharedWorker onConnect--- ${clientIdGenerator}`);
  const port = connectEvent.ports[0];
  const wsChannel = new WebSocketMessageChannel(clientIdGenerator);
  const sharedWorkerClient = new SharedWorkerClient(port, clientIdGenerator, wsChannel);
  subscriptionRegistry.registerClient(sharedWorkerClient);
  Comlink.expose(wsChannel, port);
}

function getSubscriptionsAsString(obj) {
  let s = [];
  obj.forEach((value, key) => {
    let subsc = {topicId: key, clients:[]};
    s.push(subsc);
    value.forEach(ts => {
      subsc.clients.push(ts.clientId);
    });
  });
  return JSON.stringify(s);
}

function onTimeOut() {
  console.log(`All Subscriptions--- ${getSubscriptionsAsString(subscriptionRegistry.subscriptions)}`);
  console.log(`All Subscription Topics Count: ${subscriptionRegistry.subscriptions.size}, Clients Count: ${subscriptionRegistry.connections.size}`);
  // sendMessageToAllSubscribers({topicId: 'healthCheck', message: 'ping'});
  let msg = new Map();
  msg.set("topicCount", subscriptionRegistry.subscriptions.size);
  msg.set("clientCount", subscriptionRegistry.connections.size);
  msg.set("clients", JSON.stringify(Array.from(subscriptionRegistry.connections.keys())));
  subscriptionRegistry.connections.forEach((value, clientId) => {
    msg.set(clientId, JSON.stringify([...subscriptionRegistry.getAllClientSubscriptions(clientId)]));
  });
  sendMessageToAllSubscribers({topicId: 'message', data: msg});
  setTimeout(() => {
    onTimeOut();
  }, 3000);
}
setTimeout(() => {
  onTimeOut();
}, 3000);
console.log(`SharedWorker Loaded---`);
