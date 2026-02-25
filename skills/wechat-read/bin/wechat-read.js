#!/usr/bin/env node

const { chromium } = require('playwright');

const BOOK_BASE_URL = 'https://weread.qq.com/web/reader';

async function openBook(bookIdOrUrl) {
  let bookId = bookIdOrUrl;
  
  // If it's a full URL, extract bookId
  if (bookIdOrUrl.includes('weread.qq.com')) {
    const match = bookIdOrUrl.match(/reader\/([a-zA-Z0-9]+)/);
    if (match) bookId = match[1];
  }
  
  const url = `${BOOK_BASE_URL}/${bookId}`;
  console.log(`Opening: ${url}`);
  return { url, bookId };
}

async function nextPage() {
  return { action: 'press', key: 'ArrowRight' };
}

async function prevPage() {
  return { action: 'press', key: 'ArrowLeft' };
}

async function readToc() {
  return { action: 'click', target: 'button:has-text("目录")' };
}

async function gotoChapter(chapterName) {
  return { action: 'search_chapter', chapter: chapterName };
}

// Main handler
async function main() {
  const args = process.argv.slice(2);
  const action = args[0];
  
  switch (action) {
    case 'open':
      console.log(JSON.stringify(await openBook(args[1])));
      break;
    case 'next':
      console.log(JSON.stringify(await nextPage()));
      break;
    case 'prev':
      console.log(JSON.stringify(await prevPage()));
      break;
    case 'toc':
      console.log(JSON.stringify(await readToc()));
      break;
    case 'chapter':
      console.log(JSON.stringify(await gotoChapter(args[1])));
      break;
    default:
      console.log(JSON.stringify({ error: 'Unknown action' }));
  }
}

main().catch(console.error);
