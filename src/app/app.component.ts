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
  lastMessageTime: Date = new Date(0);
  lastMessageReceived:string = '';
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
    this.webSocketMessageChannel[releaseProxy]();
  }

  getLAstMessageDuration() {
    return `${ Math.floor((new Date().getTime() - this.lastMessageTime.getTime())/1000) } seconds ago`;
  }

  ngOnInit(): void {
    console.log(`LifeCycle: ngOnInit.`);
    this.sharedWorker = new SharedWorker('../../assets/js/shared.worker.js', 'WS_SW');
    this.sharedWorker.onerror = function(event) {
      console.log(`THERE IS AN ERROR WITH YOUR WORKER! ${event}`);
    }
    this.webSocketMessageChannel = wrap(this.sharedWorker.port);
    this.lastMessageTime = new Date();
    this.webSocketMessageChannel.clientId.then((value) => this.clientId = value);
    this.webSocketMessageChannel.subscribe("healthCheck", proxy((msg: string) => {
      this.lastMessageTime = new Date();
      this.lastMessageReceived = this.getLAstMessageDuration();
      console.log(`Received healthCheck callback with Msg: ${msg}`);
    }));
    this.webSocketMessageChannel.subscribe("message", proxy((msg: WebSocketMessage<Map<string, string>>) => {
      this.sharedWorkerState = msg.data;
      console.log(`Received MESSAGE callback with Msg: ${msg}`);
    }));

    setTimeout(() => {
      this.onTimeOut();
    }, 1000);
  }

  async onTimeOut() {
    await this.webSocketMessageChannel.sendMessage(new WebSocketMessage('healthCheck', 'ping', null));
    this.subscriptions = await this.webSocketMessageChannel.getAllClientSubscriptions();
    setTimeout(() => {
      this.onTimeOut();
    }, 30000);
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
}

class WebSocketMessage<T> {
  topicId: string;
  data: T;
  headers: Map<string, string> | undefined | null;

  constructor(topicId: string, data: T, headers: Map<string, string> | undefined | null) {
    this.topicId = topicId;
    this.data = data;
    this.headers = headers;
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
