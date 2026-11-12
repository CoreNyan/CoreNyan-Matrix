import configuration from './terminology.json' with { type: 'json' };

const TOKEN = /\{\{([a-zA-Z][\w.-]*)\}\}/g;
export const escapeTerm = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

export function createTerminology(config) {
  if (config?.version !== 1 || !config.terms || Array.isArray(config.terms) || typeof config.terms !== 'object') {
    throw Error('术语配置需要 version: 1 和 terms 对象');
  }
  const source = { ...config.terms }, resolved = Object.create(null);
  function resolve(key, stack = []) {
    if (Object.hasOwn(resolved, key)) return resolved[key];
    if (!Object.hasOwn(source, key)) throw Error(`未定义的术语变量：${key}`);
    if (stack.includes(key)) throw Error(`术语循环引用：${[...stack, key].join(' → ')}`);
    const value = source[key];
    if (typeof value !== 'string' || !value.trim()) throw Error(`术语必须是非空字符串：${key}`);
    const output = value.replace(TOKEN, (_, reference) => resolve(reference, [...stack, key]));
    resolved[key] = output;
    return output;
  }
  Object.keys(source).forEach(key => resolve(key));
  Object.freeze(resolved);
  const format = (text, html = false) => String(text).replace(TOKEN, (_, key) => html ? escapeTerm(resolve(key)) : resolve(key));
  // Only static template segments contain terminology. Interpolated data is never rewritten.
  const tag = html => (parts, ...values) => parts.reduce((result, part, index) => result + format(part, html) + (index < values.length ? values[index] : ''), '');
  return Object.freeze({ terms: resolved, term: key => resolve(key), t: text => format(text), th: text => format(text, true), tt: tag(false), ht: tag(true) });
}

export const { terms: TERMS, term, t: termText, th: termHtml, tt: termTextTemplate, ht: termHtmlTemplate } = createTerminology(configuration);

export function applyStaticTerminology(root = document) {
  // Explicit placeholders only, before live data/editor content is mounted.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement?.closest('script, style') && node.data.includes('{{')) node.data = termText(node.data);
  }
  root.querySelectorAll('[title], [placeholder], [aria-label], [alt]').forEach(element => {
    for (const attribute of ['title', 'placeholder', 'aria-label', 'alt']) {
      if (element.getAttribute(attribute)?.includes('{{')) element.setAttribute(attribute, termText(element.getAttribute(attribute)));
    }
  });
  document.documentElement.removeAttribute('data-terms-pending');
}
