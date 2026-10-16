import { parseCrawlDelaySeconds } from './robots';

describe('parseCrawlDelaySeconds', () => {
  it('reads the crawl delay set for every user agent, ignoring comments', () => {
    expect(
      parseCrawlDelaySeconds(
        'User-agent: *\nCrawl-delay: 5 # seconds between requests\nAllow: /\nDisallow: /admin/',
      ),
    ).toEqual(5);
  });

  it('reads the delay of a group that lists several user agents, one of them every agent', () => {
    expect(
      parseCrawlDelaySeconds(
        'User-agent: googlebot\nUser-agent: *\nCrawl-delay: 3',
      ),
    ).toEqual(3);
  });

  it('starts a new group at a user agent line that follows a rule', () => {
    expect(
      parseCrawlDelaySeconds(
        'User-agent: *\nDisallow: /admin/\nUser-agent: googlebot\nCrawl-delay: 9',
      ),
    ).toEqual(0);
  });

  it('reads keys in any case', () => {
    expect(parseCrawlDelaySeconds('user-agent: *\ncrawl-delay: 2.5')).toEqual(
      2.5,
    );
  });

  it('ignores a crawl delay set only for another user agent', () => {
    expect(
      parseCrawlDelaySeconds(
        'User-agent: Googlebot\nCrawl-delay: 10\n\nUser-agent: *\nAllow: /',
      ),
    ).toEqual(0);
  });

  it('is zero when robots.txt sets no crawl delay', () => {
    expect(
      parseCrawlDelaySeconds('User-agent: *\nDisallow: /private/'),
    ).toEqual(0);
  });
});
