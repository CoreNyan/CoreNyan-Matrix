// Display metadata only. Execution ownership and permissions stay server-owned.
const groups = {
 dialogue: '对话生成', decision: '对话判断', review: '核验与纠错', memory: '记忆与关系', media: '图像与媒体',
 delivery: '消息与文件投递', files: '文件与项目', search: '搜索与查询', system: '系统与服务', qq: 'QQ 管理', sit: '校园服务', freecore: 'FreeCore', heybox: '小黑盒', other: '其他'
};
const purposes = {
 chat: ['dialogue','生成回复','根据当前消息、上下文和人设生成回复，也可能提出工具调用。'],
 'tool-followup': ['dialogue','工具后续生成','模型读取工具结果，决定继续执行还是回复用户；这条记录本身不是工具执行。'],
 'conversation-intent': ['decision','判断对话意图','判断本轮属于闲聊、倾诉还是任务，确定需要的工具范围。'],
 attention: ['decision','判断是否接话','结合当前消息与关系，决定是否回应。'],
 'conversation-followup': ['decision','判断后续跟进','判断是否需要在稍后继续当前话题。'],
 'emoji-expression': ['decision','选择表情包','模型按语境和真实文件名选择表情；实际投递另记为 send_emoji。'],
 'chat-completion-review': ['review','检查 CHAT 回复','核对候选回复、明确要求和工具结果，决定交付或继续修正。'],
 'private-completion-review': ['review','检查私聊回复','核对私聊候选回复和任务完成情况。'],
 'abuse-review': ['review','审核攻击性内容','判断是否存在需要处理的攻击性内容。'],
 'flood-review': ['review','审核刷屏','结合近期消息判断刷屏行为。'],
 'flood-reminder': ['dialogue','生成刷屏提醒','生成针对当前刷屏情况的提醒文字。'],
 'relationship-observer': ['memory','观察关系变化','根据真实互动评估关系和印象变化。'],
 'relationship-warning': ['memory','生成关系边界提醒','结合当前关系生成边界提醒。'],
 'question-repetition': ['decision','判断重复提问','识别近期是否反复提出同一问题。'],
 'recent-thought': ['memory','生成近期随记','根据已发生的事件生成小可的近期随记。'],
 'archive-reading-notes': ['memory','整理阅读笔记','压缩已读文件内容，供后续任务继续使用。'],
 'work-progress': ['dialogue','生成进度说明','把当前任务进展组织成给用户的说明。'],
 'gateway-cognition': ['dialogue','处理网关生成请求','响应 Gateway 提交的文本生成请求。'],
 vision: ['media','理解图片','识别当前图片并回答相关问题。'],
 'media-review': ['media','核对媒体内容','使用视觉模型核对媒体内容。'],
 'image-generation': ['media','生成图片','向图像服务提交画图请求并接收生成结果。'],
 general: ['other','通用模型请求','调用方未指定更细的用途，请结合请求正文查看。']
};
const tools = {};
function add(group, entries) { for (const [name, title] of Object.entries(entries)) tools[name] = [group, title]; }
add('delivery',{send_message:'向当前会话发送文字',send_emoji:'发送选定的表情包',send_file:'交付文件',send_channel_message:'向获准的其他渠道发送消息'});
add('memory',{record_memory:'记录长期记忆',write_knowledge:'写入知识文档',append_knowledge:'追加知识文档',rewind:'读取近期聊天记录',resume_task:'读取任务检查点',search_memory:'搜索记忆',read_memory:'读取记忆',read_knowledge:'读取技能或知识',search_history:'搜索历史记录',search_chat:'搜索聊天记录',search_member:'查找成员资料',who_is:'查询身份资料',record_thought:'记录近期随记'});
add('search',{web_search:'搜索网页',search_web:'搜索网页',web_fetch:'读取网页',list_emojis:'查询真实表情文件目录',get_user_environment:'读取当前用户获准提供的环境信息'});
add('files',{document_read:'读取文档',document_create:'创建文档',document_edit:'编辑文档',document_export:'导出文档',attachment_read:'读取附件',attachments_read:'批量读取附件',text_read:'读取文本',text_write:'创建文本文件',text_edit:'编辑文本文件',archive_read:'连续读取压缩包',archive_extract:'提取压缩包文件',archive_create:'创建压缩包',attachments_process:'批量处理附件',pdf_process:'处理 PDF',attachment_history:'查询历史附件',attachment_fetch:'取回历史附件',project_read:'读取项目源码',project_patch:'修复项目并生成交付文件',project_check:'检查项目语法'});
add('media',{describe_image:'识别图片',draw_image:'生成绘图',media_info:'查询媒体属性',image_resize:'调整图片尺寸',image_transform:'变换图片',media_transcode:'转换媒体格式',generate_video:'提交视频生成',video_status:'查询视频生成进度',video_trim:'剪切视频',video_concat:'拼接视频',video_to_gif:'视频转 GIF',gif_to_video:'GIF 转视频',edit_animation:'编辑动图',animation_status:'查询动图编辑进度',get_qq_avatar:'获取 QQ 头像'});
add('system',{describe_tools:'读取工具参数说明',project_list:'列出工作区项目',file_glob:'查找工作区文件',text_search:'搜索文件内容',file_read:'读取工作区文件',log_query:'查询服务日志',service_status:'查询服务状态',git_status:'查询仓库状态',git_diff:'查看代码差异',system_info:'查询主机信息',system_exec:'执行获准的系统命令'});
add('qq',{get_qq_user_info:'查询 QQ 用户资料',get_qq_group_info:'查询 QQ 群资料',get_qq_member_info:'查询 QQ 群成员资料'});
add('sit',{sit_query_electricity:'查询寝室电费余额'});
add('freecore',{list_players:'列出在线玩家',check_player:'查询玩家状态',bal:'查询玩家余额',get_seen:'查询玩家最近在线时间',seen:'查询玩家最近在线时间',profile_spark:'采集服务器性能',spark:'采集服务器性能',get_tps:'查询服务器 TPS',tps:'查询服务器 TPS',query_block_history:'查询方块操作历史',query_container:'查询容器信息',create_ticket:'创建服务器工单',read_command:'执行获准的只读游戏命令',get_player_connection:'查询玩家连接状态',get_world_seed:'查询世界种子',list_read_commands:'列出只读游戏命令',inspect_config:'查询服务器配置'});
add('heybox',{heybox_publish_post:'发布小黑盒动态',heybox_publish_article:'发布小黑盒文章',heybox_post_comment:'发布小黑盒评论',comment_post:'发布小黑盒评论',heybox_pin_comment:'置顶小黑盒评论',heybox_get_post:'读取小黑盒帖子',heybox_get_comments:'读取小黑盒评论',heybox_search_posts:'搜索小黑盒帖子',heybox_search_games:'搜索游戏',heybox_get_game:'查询游戏资料',heybox_find_comment:'查找小黑盒评论',heybox_get_profile:'查询小黑盒资料',heybox_list_my_posts:'列出自己的小黑盒帖子',heybox_command:'执行小黑盒适配器命令',heybox_search:'搜索小黑盒内容',heybox_get_my_posts:'读取自己的小黑盒帖子',heybox_get_user_info:'查询小黑盒用户资料'});
export const requestGroups = groups;
export function describeRequest(row) {
 const name = row.purpose || row.name || '', kind = row.kind;
 if (kind === 'tool') {
  const entry = tools[name];
  const group = entry?.[0] || (name.startsWith('heybox_') ? 'heybox' : 'other');
  return {kind:'tool', kindLabel:'工具执行', group, module:groups[group], title:entry?.[1] || name || '未命名工具', description:entry ? `执行“${entry[1]}”。请求中是实际参数，响应中是执行结果；成功与否以回执为准。` : '这是一条实际工具执行记录。当前工具尚无中文用途说明，可查看参数和执行回执。'};
 }
 if (kind === 'api') {
  const entry = purposes[name] || (name.endsWith('-repair') || name.endsWith('-recovery') ? ['review','修正回复','针对已发现的问题重新生成或修正候选回复。'] : ['other',name || '未标注用途','这是模型或生成服务请求，当前用途尚未收录说明；请查看请求正文。']);
  return {kind:'api',kindLabel:'模型 / 生成请求',group:entry[0],module:groups[entry[0]],title:entry[1],description:entry[2]};
 }
 return {kind:'other',kindLabel:'其他记录',group:'other',module:groups.other,title:name || '未知记录',description:'记录未提供已识别的类型，请结合原始字段查看。'};
}
