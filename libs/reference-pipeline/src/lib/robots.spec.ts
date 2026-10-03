import { crawlDelaySeconds } from './robots';

describe('crawlDelaySeconds', () => {
  it('reads the crawl delay set for every user agent, ignoring comments', () => {
    expect(
      crawlDelaySeconds(
        'User-agent: *\nCrawl-delay: 5 # seconds between requests\nAllow: /\nDisallow: /admin/',
      ),
    ).toEqual(5);
  });

  it('reads keys in any case', () => {
    expect(crawlDelaySeconds('user-agent: *\ncrawl-delay: 2.5')).toEqual(2.5);
  });

  it('ignores a crawl delay set only for another user agent', () => {
    expect(
      crawlDelaySeconds(
        'User-agent: Googlebot\nCrawl-delay: 10\n\nUser-agent: *\nAllow: /',
      ),
    ).toEqual(0);
  });

  it('is zero when robots.txt sets no crawl delay', () => {
    expect(crawlDelaySeconds('User-agent: *\nDisallow: /private/')).toEqual(0);
  });
});
