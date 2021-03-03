const cheerio = require('cheerio');

const HOME_PAGE = 'https://apnews.com';

const getData = async (browser, url) => {
    const page = await browser.newPage();
    await page.goto(url);
    return await page.evaluate(() => document.documentElement.innerHTML);
}
module.exports = async (ctx) => {
    const topic = ctx.params.topic;

    const url_link = `${HOME_PAGE}/hub/${topic}`;
    const browser = await require('@/utils/puppeteer')();
    const html = await getData(browser, url_link);

    const $ = cheerio.load(html);

    const list = [];
    $('div.FeedCard').each(function (index, item) {
        if ($(item).find('a[class^=Component-headline]').attr('href') !== undefined) {
            list.push(item);
        }
    });

    const out = await Promise.all(
        list.map(async (article) => {
            const link = url.resolve('https://apnews.com', $(article).find('a[class^=Component-headline]').attr('href'));

            const [title, author, pubDate, description] = await ctx.cache.tryGet(link, async () => {
                const result = await getData(browser, link);

                const $ = cheerio.load(result);

                const head = JSON.parse($('script[type="application/ld+json"]').html());

                const title = head.headline;
                const author = head.author.join(' & ');
                const pubDate = head.datePublished;

                const text = $('div.Article').html();
                const imageUrl = head.image;
                const description = `<img src="${imageUrl}">` + text;
                return [title, author, pubDate, description];
            });
            const item = {
                title: title,
                description: description,
                pubDate: pubDate,
                link: link,
                author: author,
            };
            return Promise.resolve(item);
        });
    );
    ctx.state.data = {
        title: $('.Body div').find('h1[class^=hubTitle]').text(),
        link: url_link,
        item: out
    };
    
    browser.close();
};
