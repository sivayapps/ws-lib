import {Component, HostListener, OnDestroy, OnInit} from '@angular/core';
import {releaseProxy, Remote, wrap, proxy} from 'comlink';

// import sharedWorkerUrl from 'worker-plugin/loader?name=sharedWorker&esModule!./shared-worker.worker.js'; //not working
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass']
})
export class AppComponent implements OnInit, OnDestroy {
  title: string = 'ws-lib';
  topicId: string = "";
  clientId: string = "";
  initTime: Date = new Date();
  sharedWorkerInitTime: Date = new Date();
  lastHeartBeatReceiveTime: Date = new Date(0);
  lastHeartBeatSentTime: Date = new Date(0);
  sharedWorker!: SharedWorker;
  subscriptions!: Set<string>;
  sharedWorkerState!: Map<string, string>;
  private webSocketMessageChannel!: Remote<WebSocketMessageChannel<any>>;

  @HostListener('window:beforeunload', ['$event'])
  unloadHandler(event: Event) {
    console.log(`LifeCycle: unloadHandler. ${event}`);
    this.webSocketMessageChannel.close();
  }

  ngOnDestroy(): void {
    console.log(`LifeCycle: ngOnDestroy.`);
    this.closeSharedWorker();
  }

  private closeSharedWorker() {
    console.log(`try CLEANING(CLOSING) SHARED_WORKER!`);
    this.webSocketMessageChannel[releaseProxy]();
    this.sharedWorker.port.close();
    console.log(`CLEANED(CLOSED) SHARED_WORKER!`);
  }

  getLastMessageDuration(instantTime:Date) {
    return Math.floor((new Date().getTime() - instantTime.getTime())/1000);
  }

  getUpTime(initTime: Date) {
    let millis = new Date().getTime() - initTime.getTime();
    let millisPerMinute = 60000;
    let millisPerHour = millisPerMinute * 60;
    let millisPerDay = millisPerHour * 24;
    let days = Math.floor(millis/millisPerDay);
    let hours = Math.floor((millis % millisPerDay)/millisPerHour);
    let minutes = Math.floor((millis % millisPerHour)/millisPerMinute);
    let seconds = Math.floor((millis % millisPerMinute)/1000);
    return `${days >0?(days+'days '):''}${hours >0?(hours+' hours '):''}${minutes >0?(minutes+' minutes '):''}${seconds >0?(seconds+' seconds'):''}`;
  }

  ngOnInit(): void {
    console.log(`LifeCycle: ngOnInit.`);
    this.initSharedWorker();
    setTimeout(() => {
      this.onTimeOut();
    }, 1000);
  }

  private initSharedWorker() {
    console.log(`Initializing Shared Worker!`);
    this.sharedWorkerInitTime = new Date();
    this.sharedWorker = new SharedWorker('../../assets/js/shared.worker.js', 'WS_SW');
    this.sharedWorker.onerror = function (event) {
      console.log(`THERE IS AN ERROR WITH YOUR WORKER! ${event}`);
    }
    this.webSocketMessageChannel = wrap(this.sharedWorker.port);
    this.lastHeartBeatReceiveTime = new Date();
    this.webSocketMessageChannel.clientId.then((value) => this.clientId = value);
    this.webSocketMessageChannel.subscribe("heartbeat", proxy((msg: WebSocketMessage<string>) => {
      this.lastHeartBeatReceiveTime = new Date();
      console.log(`Received  heartbeat: ${msg.data}, in ${this.lastHeartBeatReceiveTime.getTime() - msg.messageTime.getTime()} Millis.`);
    }));
    this.webSocketMessageChannel.subscribe("message", proxy((msg: WebSocketMessage<Map<string, string>>) => {
      this.sharedWorkerState = msg.data;
      console.log(`Received MESSAGE callback with Msg: ${JSON.stringify(msg.topicId)}, data: ${JSON.stringify(Array.from(msg.data.entries()))}`);
    }));
    console.log(`Initialized Shared Worker!`);
  }

  async onTimeOut() {
    setTimeout(() => {
      this.onTimeOut();
    }, 5000);
    console.log(`ClientID: ${this.clientId} - lastHeartBeatSentTime: ${this.getLastMessageDuration(this.lastHeartBeatSentTime)}, lastHeartBeatReceiveTime: ${this.getLastMessageDuration(this.lastHeartBeatReceiveTime)}!`);
    //sometimes non active tabs reloading sharedworker even when it's active, may be due to timer run delays(need further investigation), to identify timer delay, check last heartbeat sent time
    if(this.getLastMessageDuration(this.lastHeartBeatReceiveTime) > 30 && this.getLastMessageDuration(this.lastHeartBeatSentTime) < 10) {
      console.log(`RE_LOADING Shared Worker, as No HEARTBEAT Received from SHARED_WORKER since last 30 seconds!`);
      this.closeSharedWorker();
      this.initSharedWorker();
      console.log(`RE_LOADED Shared Worker, as No HEARTBEAT Received from SHARED_WORKER since last 30 seconds!`);
    }
    this.lastHeartBeatSentTime = new Date();
    let heartbeatMessage = new WebSocketMessage('heartbeat', 'ping', null, new Date());
    console.log(`Sending heartbeat: ${heartbeatMessage.data}`);
    await this.webSocketMessageChannel.sendMessage(heartbeatMessage);
    this.subscriptions = await this.webSocketMessageChannel.getAllClientSubscriptions();
    this.sharedWorkerInitTime = await this.webSocketMessageChannel.getInitTime();
  }

  unSubscribe() {
    this.webSocketMessageChannel.unSubscribe(this.topicId);
  }

  async subscribe() {
    await this.webSocketMessageChannel.subscribe(this.topicId, proxy((msg: string) => console.log(`Thread '${this.topicId}' subscription Received callback with Msg: ${msg}`)));
    this.subscriptions = await this.webSocketMessageChannel.getAllClientSubscriptions();
  }
}

interface WebSocketMessageChannel<T> {
  clientId: string;

  sendMessage(message: WebSocketMessage<T>): void;

  subscribe(topicId: string, callback: any): void;

  unSubscribe(topicId: string): void;

  getAllClientSubscriptions(): Set<string>;

  close(): void;
  getInitTime(): Date;
}

class WebSocketMessage<T> {
  topicId: string;
  data: T;
  headers: Map<string, string> | undefined | null;
  messageTime: Date = new Date();

  constructor(topicId: string, data: T, headers: Map<string, string> | undefined | null, messageTime: Date| undefined | null) {
    this.topicId = topicId;
    this.data = data;
    this.headers = headers;
    this.messageTime = messageTime?messageTime:new Date();
  }
}

if (typeof Worker !== 'undefined') {
  // Create a new
  const worker = new Worker(new URL('./app.worker', import.meta.url));
  worker.onmessage = ({data}) => {
    console.log(`page got message: ${data}`);
  };
  worker.postMessage('hello');
} else {
  // Web Workers are not supported in this environment.
  // You should add a fallback so that your program still executes correctly.
}
