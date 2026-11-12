// Preserve literal escapes and code. Only add CJK-friendly emphasis tokenization.
let parser;
export function renderChatMarkdown(text,marked=window.marked,purify=window.DOMPurify){
 if(!marked||!purify)return null;
 if(!parser){parser=new marked.Marked({breaks:true,gfm:true});parser.use({extensions:[{name:'cjkStrong',level:'inline',start(src){return src.indexOf('**');},tokenizer(src){const match=/^\*\*(?!\*)([^\n]+?)\*\*(?!\*)/.exec(src);if(!match||!match[1].trim()||match[1].includes('`'))return;return {type:'cjkStrong',raw:match[0],tokens:this.lexer.inlineTokens(match[1])};},renderer(token){return '<strong>'+this.parser.parseInline(token.tokens)+'</strong>';}}]});}
 return purify.sanitize(parser.parse(String(text||'')));
}
