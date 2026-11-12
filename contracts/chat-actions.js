import {term} from './terminology.js';
export const CHAT_ACTIONS=Object.freeze({
 copy:term('action.copy'),copied:'已复制',
 icons:Object.freeze({copy:'M9 9h11v11H9zM5 15H3V3h12v2',edit:'m15 5 4 4M4 20l5-1L21 7a2.8 2.8 0 0 0-4-4L5 15z',withdraw:'M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12',retry:'M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9'}),
 edit:term('action.edit'),withdraw:term('action.withdraw'),retry:term('action.retry'),replyOnly:term('action.replyOnly'),edited:'已编辑',withdrawn:'消息已撤回',
 editTitle:'编辑消息',editSave:'保存',withdrawTitle:'撤回这条消息？',
 replyOnlyTitle:'重新回复这条消息？',replyOnlyDescription:'上次的操作可能已经执行。这次只重新回答，不重复执行工具操作。',
 saved:'消息已修改',removed:'消息已撤回',retrying:'正在重试…',
 errors:Object.freeze({CHAT_MESSAGE_VERSION_CONFLICT:'这条消息已在其他设备修改，已为你刷新。',CHAT_MESSAGE_WITHDRAWN:'这条消息已撤回。',CHAT_BUSY:'这段对话还在处理中，请先停止或稍后重试。',CHAT_MESSAGE_EDIT_DENIED:'只能修改或撤回自己发送的消息。',CHAT_COMMAND_RETRY_UNSUPPORTED:'请重新发送这条指令。',CHAT_MESSAGE_NOT_FOUND:'这条消息已不存在。',RPC_RESULT_UNKNOWN:'操作结果暂时无法确认，请刷新查看；重试会继续核对同一次操作。'})
});
