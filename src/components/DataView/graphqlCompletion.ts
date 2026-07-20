import type { languages } from 'monaco-editor';

/**
 * GraphQL 自动补全 — 基于 Weaviate Schema 智能提示
 *
 * 补全内容:
 * 1. 集合名（Get / Aggregate 块内）
 * 2. 属性名（根据上下文检测当前集合）
 * 3. GraphQL 关键字（Get, Aggregate, limit, where, nearText 等）
 * 4. _additional 子字段
 */

const GRAPHQL_KEYWORDS = [
  'Get', 'Aggregate', 'Explore', 'Mutation',
  'limit', 'offset', 'after', 'where', 'orderBy', 'groupBy',
  'bm25', 'hybrid', 'nearText', 'nearVector', 'nearImage', 'nearObject',
  'containsAny', 'containsAll', 'like', 'equal', 'notEqual',
  'greaterThan', 'greaterThanEqual', 'lessThan', 'lessThanEqual',
  'valueText', 'valueInt', 'valueNumber', 'valueBoolean', 'valueDate',
  'operator', 'path', 'operands',
];

const ADDITIONAL_FIELDS = [
  'id', 'vector', 'distance', 'score', 'certainty', 'explain',
  'generation', 'rerank', 'semanticPath',
];

interface SchemaData {
  collections: string[];
  properties: Map<string, string[]>; // className -> property names
}

/**
 * 检测光标所在位置属于哪个集合
 * 向上查找最近的 Get/Aggregate 块，提取集合名
 */
function detectCurrentClass(
  model: { getLineContent: (lineNumber: number) => string },
  position: { lineNumber: number },
): string | null {
  for (let line = position.lineNumber; line >= 1; line--) {
    const text = model.getLineContent(line);
    // 匹配 "  CollectionName {" 或 "CollectionName(" 等
    const match = text.match(/\b([A-Z]\w+)\s*[({]/);
    if (match && !['Get', 'Aggregate', 'Explore', 'Mutation'].includes(match[1])) {
      return match[1];
    }
  }
  return null;
}

export function createGraphQLCompletionProvider(
  schema: SchemaData,
): languages.CompletionItemProvider {
  return {
    triggerCharacters: ['{', '(', ' ', '\n', '.'],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: languages.CompletionItem[] = [];

      // 集合名补全
      schema.collections.forEach((cls) => {
        suggestions.push({
          label: cls,
          kind: 6, // CompletionItemKind.Class
          insertText: cls,
          detail: 'Weaviate Collection',
          range,
        });
      });

      // 属性名补全 — 根据上下文检测当前集合
      const currentClass = detectCurrentClass(model, position);
      if (currentClass && schema.properties.has(currentClass)) {
        schema.properties.get(currentClass)!.forEach((prop) => {
          suggestions.push({
            label: prop,
            kind: 5, // CompletionItemKind.Field
            insertText: prop,
            detail: `${currentClass} property`,
            range,
          });
        });
      } else {
        // 没有检测到集合时，列出所有属性
        const allProps = new Set<string>();
        schema.properties.forEach((props) => props.forEach((p) => allProps.add(p)));
        allProps.forEach((prop) => {
          suggestions.push({
            label: prop,
            kind: 5,
            insertText: prop,
            detail: 'property',
            range,
          });
        });
      }

      // _additional 子字段
      ADDITIONAL_FIELDS.forEach((field) => {
        suggestions.push({
          label: field,
          kind: 5,
          insertText: field,
          detail: '_additional field',
          range,
        });
      });

      // GraphQL 关键字
      GRAPHQL_KEYWORDS.forEach((kw) => {
        suggestions.push({
          label: kw,
          kind: 14, // CompletionItemKind.Keyword
          insertText: kw,
          range,
        });
      });

      return { suggestions };
    },
  };
}

export type { SchemaData };
