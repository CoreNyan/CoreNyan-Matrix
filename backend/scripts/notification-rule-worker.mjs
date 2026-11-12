import {parentPort,workerData} from 'node:worker_threads';
import {matchRules} from '../../contracts/notification-rules.js';
try{const {rules,event,list,combine}=workerData;parentPort.postMessage({matched:list?(combine==='all'?list.every(r=>r.enabled&&matchRules(r,event)):list.some(r=>r.enabled&&matchRules(r,event))):matchRules(rules,event)});}catch{parentPort.postMessage({error:true});}
