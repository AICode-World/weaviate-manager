import type { WeaviateClient } from 'weaviate-ts-client';
import { getCachedClassProperties } from './schemaService';
import { qSearchBM25, qSearchNearText } from './graphqlQueries';
import { extractGetResults, flattenAdditional } from './graphqlHelpers';

/** BM25 关键词搜索 */
export async function searchBM25(
  client: WeaviateClient,
  className: string,
  query: string,
  limit: number = 20,
): Promise<Record<string, unknown>[]> {
  let propNames: string[] = [];
  try {
    propNames = await getCachedClassProperties(client, className);
  } catch { /* ignore */ }
  const propFields = propNames.length > 0 ? propNames.join(' ') + ' ' : '';

  const queryStr = qSearchBM25(className, propFields, query, limit);
  const result = await client.graphql.raw().withQuery(queryStr).do();
  return extractGetResults(result.data, className).map(flattenAdditional);
}

/** 语义搜索 */
export async function searchNearText(
  client: WeaviateClient,
  className: string,
  concepts: string,
  limit: number = 20,
  distance: number = 0.7,
): Promise<Record<string, unknown>[]> {
  let propNames: string[] = [];
  try {
    propNames = await getCachedClassProperties(client, className);
  } catch { /* ignore */ }
  const propFields = propNames.length > 0 ? propNames.join(' ') + ' ' : '';

  const queryStr = qSearchNearText(className, propFields, concepts, limit, distance);
  const result = await client.graphql.raw().withQuery(queryStr).do();
  return extractGetResults(result.data, className).map(flattenAdditional);
}

/** 多模态文字搜索 */
export async function searchNearTextWithVector(
  client: WeaviateClient,
  className: string,
  text: string,
  limit: number = 12,
  targetVector?: string,
): Promise<Record<string, unknown>[]> {
  let propNames: string[] = [];
  try {
    propNames = await getCachedClassProperties(client, className);
  } catch { /* degrade to empty property list */ }
  const nearTextArgs: Record<string, unknown> = { concepts: [text] };
  if (targetVector) nearTextArgs.targetVectors = [targetVector];
  const gqlGet = client.graphql
    .get()
    .withClassName(className)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withNearText(nearTextArgs as any)
    .withLimit(limit)
    .withFields([...propNames, '_additional { id distance }'].join(' '));

  const result = await gqlGet.do();
  return extractGetResults(result.data, className).map(flattenAdditional);
}

/** 图片相似搜索 */
export async function searchNearImage(
  client: WeaviateClient,
  className: string,
  imageBase64: string,
  limit: number = 12,
  distance: number = 0.7,
): Promise<Record<string, unknown>[]> {
  let propNames: string[] = [];
  try {
    propNames = await getCachedClassProperties(client, className);
  } catch { /* degrade to empty property list */ }
  const gqlGet = client.graphql
    .get()
    .withClassName(className)
    .withNearImage({ image: imageBase64, distance })
    .withLimit(limit)
    .withFields([...propNames, '_additional { id distance }'].join(' '));

  const result = await gqlGet.do();
  return extractGetResults(result.data, className).map(flattenAdditional);
}
