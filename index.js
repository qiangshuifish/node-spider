const Crawler = require('crawler');//http://node-crawler.readthedocs.io/zh_CN/latest/reference/main/
const cheerio = require('cheerio');//http://cnodejs.org/topic/5203a71844e76d216a727d2e
const EventEmitter = require('events');
const mongo = require('./mongo.js');
const col_movie_log = "movie_log";
const col_movie = "movie";


const dateRegex = /[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}/;
const movies = [];
const listPages = [];
const LIST_PAGE_PREFIX = "http://www.dytt8.net/html/gndy/dyzz/";
const DETAIL_PAGE_PREFIX = "http://www.dytt8.net";

let insertCount = 0;
let listPageSize = 0;
let corruntListPage = 0;

let emitter = new EventEmitter();



console.time("耗时：");

/**
 * 监听爬取列表页面
 */
emitter.on('parseListPage',function (url) {
    if(listPages.length > 0){
        const url = listPages.pop();
        crawler.queue([{
            uri: url,
            callback: function (err, res, done) {
                corruntListPage++;
                console.log(`============== ${corruntListPage}/${listPageSize}爬取电影列表页面 ${res.request.uri.href} ==============`)
                const $ = cheerio.load(res.body,{decodeEntities: false});
                parseListPage($);
                emitter.emit('parseDetailPage')
                done();
            }
        }]);
    }
});


/**
 * 监听爬取详情页面
 */
emitter.on('parseDetailPage',function () {
    while (movies.length > 0){
        const movie = movies.pop();
        crawler.queue([{
            uri: movie.url,
            callback: function (err, res, done) {
                console.log(`============== 爬取电影详情页面 ${res.request.uri.href} ==============`)
                mongoLog(res);

                const $ = cheerio.load(res.body,{decodeEntities: false});
                parseDetailPage($,movie);
                done();
            }
        }]);
    }
    emitter.emit('parseListPage')
});

/**
 * 记录详情页面
 * @param res
 */
function mongoLog(res) {
    res.request.uri.href.split("\\")
    let mongoDoc = {
        movie_id: res.request.uri.href.split('/').pop().replace(".html", ""),
        html: res.body,
        url: res.request.uri.href,
        create_time: new Date()
    };

    mongo.findCont(col_movie_log, {url: mongoDoc.url}).then(function (count) {
        if (count <= 0) {
            mongo.insert(col_movie_log, mongoDoc);
        }
    }).catch(function (e) {
        throw e;
    });;
}

/**
 * 解析list页面
 * @param $
 */
function parseListPage($) {
    let movieTableList = $('.co_area2').children();
    movieTableList.splice(0, 4)
    movieTableList.find('table').each(function (index, table) {
        let movie = {};
        movie.name = $(table).find('.ulink').html();
        movie.url = DETAIL_PAGE_PREFIX + $(table).find('.ulink').attr('href');

        movie.date = dateRegex.exec($(table).find('font').text())[0];
        movie.content = $(table).find('td').last().html();
        movies.push(movie);
    });
}


/**
 * 解析详情页面
 * @param $
 * @param movie
 */
function parseDetailPage($,movie) {
    let table = $('#Zoom').children()[0];
    movie.image = $(table).find('img').attr('src');

    let ftp = $(table).find("table").children()[0];
    movie.ftp= $(ftp).find("a").attr("href");
    let magnet = $(table).find("table").children()[1];
    movie.magnet= $(magnet).find("a").attr("href");
    movie.content = $(table).text()

    mongo.findCont(col_movie, {url: movie.url}).then(function (count) {
        if(count <= 0){
            mongo.insert(col_movie,movie).then(function (res) {
                insertCount++;
                console.log(`============== 第${insertCount}条 ${movie.name} 导入成功 ==============`)
            });
        }
    }).catch(function (e) {
        throw e;
    });
}


/**
 * 初始化一个爬虫对象
 * @type {Crawler}
 */
const crawler = new Crawler({
    jQuery: false,
    headers :{

    },
    rotateUA:true,
    userAgent:['Mozilla/5.0 (Windows NT 10.0; WOW64)','AppleWebKit/537.36 (KHTML, like Gecko)','Chrome/55.0.2883.87 Safari/537.36'],
    maxConnections: 5,
    callback: function (error, res, done) {
        if (error) {
            console.trace(error);
        } else {
            const $ = cheerio.load(res.body,{decodeEntities: false});
            let options = $("[name='sldd']").find('option');
            options.each(function (index,option) {
                let uri = $(option).attr('value');
                let url = `${LIST_PAGE_PREFIX}${uri}`;
                listPages.push(url);
            });
            listPageSize = listPages.length;
            emitter.emit('parseListPage');
        }
        done();
    }
});

/**
 * 初始化 mongo
 */
mongo.initClient(function (client) {
    crawler.queue('http://www.dytt8.net/html/gndy/dyzz/index.html');
});


/**
 * 爬取结束的回调
 */
crawler.on('drain',function(){
    console.time("耗时：");
    console.log(`存储电影${insertCount}个，爬取列表页面${corruntListPage}`)
});

