/**
 * The posts of one timeline cell.
 *
 * X may draw a whole thread inside a single cell (a post and its reply in the
 * 2026 modern build), and a quote embed nests its own `<article>` inside a
 * post. Only the posts returned here belong to the cell itself; the nested
 * ones are part of another post and must not be used to link the cell to its
 * neighbours.
 *
 * @param {Element[]} articles articles of the cell, in document order
 * @returns {Element[]} the cell's own posts
 */
export function cellPosts(articles) {
  return articles.filter((article) => !article.parentElement?.closest?.('article'));
}
