'use strict';

function isEnPost(post) {
  return post.slug && post.slug.endsWith('-en');
}

// Auto-hide posts with '-en' suffix from listings
// Runs after theme's post-filter (priority 10) which creates the collections
hexo.extend.filter.register('before_generate', function() {
  const posts = this.locals.get('posts');
  const indexPosts = this.locals.get('index_posts');

  const enPosts = posts.data.filter(isEnPost);

  if (enPosts.length > 0) {
    // Remove from index_posts (homepage listing)
    if (indexPosts) {
      const filteredIndexPosts = indexPosts.filter(post => !isEnPost(post));
      this.locals.set('index_posts', filteredIndexPosts);
    }

    // Create archive_posts collection (used by archive/tag/category pages)
    const filteredPosts = posts.filter(post => !isEnPost(post));
    this.locals.set('archive_posts', filteredPosts);

    hexo.log.info(`[hide-en-posts] Hid ${enPosts.length} English version post(s) from listings`);
  }
}, 15);

// Override archive generator to exclude English posts
const originalArchiveGenerator = hexo.extend.generator.get('archive');
if (originalArchiveGenerator) {
  hexo.extend.generator.register('archive', function(locals) {
    return originalArchiveGenerator.bind(this)({
      posts: locals.archive_posts || locals.posts
    });
  });
}

// Override tag generator to exclude English posts from output
const originalTagGenerator = hexo.extend.generator.get('tag');
if (originalTagGenerator) {
  hexo.extend.generator.register('tag', function(locals) {
    const pages = originalTagGenerator.bind(this)(locals);
    return pages.map(page => {
      if (page.data && page.data.posts) {
        page.data.posts = page.data.posts.filter(post => !isEnPost(post));
      }
      return page;
    });
  });
}

// Override category generator to exclude English posts from output
const originalCategoryGenerator = hexo.extend.generator.get('category');
if (originalCategoryGenerator) {
  hexo.extend.generator.register('category', function(locals) {
    const pages = originalCategoryGenerator.bind(this)(locals);
    return pages.map(page => {
      if (page.data && page.data.posts) {
        page.data.posts = page.data.posts.filter(post => !isEnPost(post));
      }
      return page;
    });
  });
}
