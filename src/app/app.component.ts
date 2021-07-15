import {Component, OnDestroy, OnInit} from '@angular/core';
import {releaseProxy, Remote, wrap, proxy} from 'comlink';

// import sharedWorkerUrl from 'worker-plugin/loader?name=sharedWorker&esModule!./shared-worker.worker.js'; //not working
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass']
})
export class AppComponent implements OnInit, OnDestroy {
  title: string = 'ws-lib';
  clicked: boolean = false;
  wsData: string = "Not Yet";
  threadId: string = "";
  sharedWorker!: SharedWorker;
  subscriptions!: Set<string>;
  private webSocketMessageChannel!: Remote<WebSocketMessageChannel>;

  ngOnDestroy(): void {
    this.webSocketMessageChannel[releaseProxy]();
  }

  ngOnInit(): void {
    this.sharedWorker = new SharedWorker('../../assets/js/shared.worker.js', 'WS_SW');

    this.webSocketMessageChannel = wrap(this.sharedWorker.port);
    this.webSocketMessageChannel.subscribe("healthCheck", proxy((msg: string) => console.log(`Received callback with Msg: ${msg}`)));
    this.webSocketMessageChannel.subscribe("r1", proxy((msg: string) => console.log(`Received callback with Msg: ${msg}`)));
    this.webSocketMessageChannel.subscribe("r2", proxy((msg: string) => console.log(`Received callback with Msg: ${msg}`)));
    this.webSocketMessageChannel.subscribe("t1", proxy((msg: string) => console.log(`Received callback with Msg: ${msg}`)));
    // this.sharedWorker.port.onmessage = (event) => {
    //   console.log(`page got shared worker message: ${event.data}`);
    // };
    // this.sharedWorker.port.start();
    setTimeout(() => {
      this.onTimeOut();
    }, 1000);
  }

  async onTimeOut() {
    this.webSocketMessageChannel.sendMessage('shared hello');
    this.subscriptions = await this.webSocketMessageChannel.getAllClientSubscriptions();
    setTimeout(() => {
      this.onTimeOut();
    }, 10000);
  }

  unSubscribe() {
    this.webSocketMessageChannel.unSubscribe(this.threadId);
  }

  async subscribe() {
    await this.webSocketMessageChannel.subscribe(this.threadId, proxy((msg: string) => console.log(`Thread '${this.threadId}' subscription Received callback with Msg: ${msg}`)));
    this.subscriptions = await this.webSocketMessageChannel.getAllClientSubscriptions();
  }
}

interface WebSocketMessageChannel {
  clientId: string;

  sendMessage(message: any): void;

  subscribe(topicId: string, callback: any): void;

  unSubscribe(topicId: string): void;

  getAllClientSubscriptions() : Set<string>;
}

if (typeof Worker !== 'undefined') {
  // Create a new
  const worker = new Worker(new URL('./app.worker', import.meta.url));
  worker.onmessage = ({ data }) => {
    console.log(`page got message: ${data}`);
  };
  worker.postMessage('hello');
} else {
  // Web Workers are not supported in this environment.
  // You should add a fallback so that your program still executes correctly.
}
