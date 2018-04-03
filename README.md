# 基于事件驱动的nodejs的爬虫
研究node大半个月了，怕和之前一样学完即忘掉，打算写点东西练练手，说干就干，花个半天时间撸个爬虫。
本文将使用`nodejs`基于`crawler`和`cheerio`和构建一个简单又高效的的爬虫，本文涉及到的知识点。

 - ES5/6 语法基础
 - nodejs 基础
 - crawler node爬虫工具
 - cheerio nodejs版jQuery
 - HTML/jQuery
 - mongodb 数据库
 
本文以电影天堂为目标，爬取网站[2018新片精品](http://www.dytt8.net/html/gndy/dyzz/index.html)这一栏目的所有电影。我在写这个爬虫的时候，这一栏目有`共173页/4301条记录`不算多也不算少，数据刚好狗我练手。接下来开始着手设计。

## 第一步 介绍 crawler 
crawler 是一个爬虫框架，各种各样语言的版本都有，这里只简单介绍nodejs版本的。这里首先贴上github的地址`https://github.com/bda-research/node-crawler`,还有它的中文文档地址`http://node-crawler.readthedocs.io/zh_CN/latest`,话不多少，撸代码：

```javascript
const Crawler = require('crawler');
const crawler = new Crawler({
    callback : function (err, res, done) {
        if(err){
            throw err;
        }
        console.log(res.body);
        done();
    }
});
crawler.queue('http://www.dytt8.net/html/gndy/dyzz/index.html');
```

短短的几行代码一个简单爬虫就撸好了，`callback`有三个参数:`err`是错误信息，`res`是`http.IncomingMessage`,包含了我们需要的各种各样的信息，
`done`是一个回调函数，在`callback`处理结束之后必须调用此函数。当然我们写得爬虫不会这么简单，需要用到`crawler`的其他特性。

```javascript
const Crawler = require('crawler');

const crawler = new Crawler({
    jQuery: false,//res.$ 自带的DOM解析工具，此处不要自带的
    headers :{//设置一些请求头
        Connection:'keep-alive',
        Referer:'http://www.dytt8.net/'
    },
    rotateUA:true,//开启 User-Agent 请求头的切换，userAgent 必须为数组
    userAgent:['Mozilla/5.0 (Windows NT 10.0; WOW64)','AppleWebKit/537.36 (KHTML, like Gecko)','Chrome/55.0.2883.87 Safari/537.36'],
    maxConnections: 5,//最大连接数，默认10我网速慢设置为5
    callback : function (err, res, done) {
        if(err){
            throw err;
        }
        console.log(res.body);
        done();
    }
});

//添加连接时指定处理函数，此时不会调用全局的 callback
crawler.queue([{
    uri:'http://www.dytt8.net/html/gndy/dyzz/index.html',
    callback:function (err, res, done) {
        if(err){
            throw err;
        }
        console.log(res.body);
        done();
    }
}]);
//可以批量添加连接
crawler.queue(['http://www.dytt8.net/html/gndy/dyzz/index.html','http://www.dytt8.net/html/gndy/dyzz/index.html']);
```

## 第二步 介绍 cheerio 
单说`cheerio`可能知道的人很少，但是如果说jQuery，会看这边文章的人相信都非常的熟悉，没错`cheerio`就是nodejs版的jQuery,它相比jQuery进行了大量的精简去掉了一些浏览器相关的部分。这里也先贴上文档`//http://cnodejs.org/topic/5203a71844e76d216a727d2e`和github地址`https://github.com/cheeriojs/cheerio`。它使用起来跟jQuery几乎没区别。

```javascript
const cheerio = require('cheerio');

const $ = cheerio.load(res.body,{decodeEntities: false});
let options = $("[name='sldd']").find('option');
console.log($(options).html())
console.log($(options).text())
```

## 第三步 EventEmitter
`EventEmitter`是nodejs核心库之一，它提供了一种基于事件编程的方式。它的优劣这里不多说，我们的重点不是这个。

```javascript
const EventEmitter = require('events');

let emitter = new EventEmitter();
emitter.on("message",function (msg) {
    console.log(msg)
});
emitter.emit('message',"hello Word")
```

新建一个js文件，运行上列代码，输出`hello Word`，嗯就这么简单。

## 第四步 解析HTML页面 
回到我们的第一步中，打印出来的`res.body`,复制出来，粘贴到某个支持HTML高亮的编辑器中或者直接使用浏览器打开哪个网址，使用`F12`，找到我们我们需要的连接：**详情页面地址**，**下一页的地址**。我们发现这个页面里头有个`select`标签里头有所有列表页面的地址，所以现在我们只需要把它取出来放到一个全局数组`listPages`中就不需要在每一个列表页面去获取下一页的地址了。

```javascript
let listPages = [];
const LIST_PAGE_PREFIX = "http://www.dytt8.net/html/gndy/dyzz/";

const $ = cheerio.load(res.body,{decodeEntities: false});
let options = $("[name='sldd']").find('option');
options.each(function (index,option) {
    let uri = $(option).attr('value');
    let url = `${LIST_PAGE_PREFIX}${uri}`;
    listPages.push(url);
});
```

然后是电影列表，发现电影列表全是表格，并且在一个 class为`co_area2`的div中；`let movieTableList = $('.co_area2').children();`获取所有的装有电影信息的table,这里不多解释了，直接上代码撸。到现在我们完整的代码应该是这样。

```javascript
const Crawler = require('crawler');
const cheerio = require('cheerio');
const EventEmitter = require('events');

const dateRegex = /[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}/;
const movies = [];
const listPages = [];
const LIST_PAGE_PREFIX = "http://www.dytt8.net/html/gndy/dyzz/";
const DETAIL_PAGE_PREFIX = "http://www.dytt8.net";

let emitter = new EventEmitter();

emitter.on("message",function (msg) {
    console.log()
});

emitter.emit('message',"hello Word")

const crawler = new Crawler({
    jQuery: false,//res.$ 自带的DOM解析工具，此处不要自带的
    headers :{//设置一些请求头
        Connection:'keep-alive',
        Referer:'http://www.dytt8.net/'
    },
    rotateUA:true,//开启 User-Agent 请求头的切换，userAgent 必须为数组
    userAgent:['Mozilla/5.0 (Windows NT 10.0; WOW64)','AppleWebKit/537.36 (KHTML, like Gecko)','Chrome/55.0.2883.87 Safari/537.36'],
    maxConnections: 5,//最大连接数，默认10我网速慢设置为5
    callback : function (err, res, done) {
        if(err){
            throw err;
        }
        const $ = cheerio.load(res.body,{decodeEntities: false});
        
        // 获取所有列表页面的地址
        let options = $("[name='sldd']").find('option');
        options.each(function (index,option) {
            let uri = $(option).attr('value');
            let url = `${LIST_PAGE_PREFIX}${uri}`;
            listPages.push(url);
        });
        console.log(listPages);
        
        // 解析电影列表
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
        console.log(movies)

        done();
    }
});

crawler.queue("http://www.dytt8.net/html/gndy/dyzz/index.html")
```

运行代码，可以看到每一页的电影信息和所有的列表页面地址都已经获取到了，电影列表页面的解析也基本完成了，接下来需要解析电影详情页面。解析方式也和列表页面一致，这里不再赘叙。

```javascript
/**
 * 解析详情页面
 * @param $
 * @param movie
 */
function parseDetailPage($) {
    let movie = {};
    let table = $('#Zoom').children()[0];
    movie.image = $(table).find('img').attr('src');

    let ftp = $(table).find("table").children()[0];
    movie.ftp= $(ftp).find("a").attr("href");
    
    let magnet = $(table).find("table").children()[1];
    movie.magnet= $(magnet).find("a").attr("href");
    
    movie.content = $(table).text()
    console.log(movie)
}
```

到这里页面解析的部分完成了，接下来该思考如何让爬虫在爬完一个列表页面后爬取解析到的详情页面地址，当然也可以先获取全部的详情页面地址，再统一爬取，但这样显然不符合一个优秀爬虫的设计。其实这里就可以看做是一个`生产者-消费者`的模式,如果没听说过这个名词的可以先百度理解一下，然后看看这篇文章[JavaScript 异步编程](http://www.qiangshuidiyu.xin/post/js-async.html#toc-c72)中最后一个例子。这里我们也可以采用这种设计。

 - 第一步先获取一个页面，获取所有的列表页面地址，存储起来，触发生产者事件
 - 生产者爬取一个列表页面地址，解析出每一个页面的所有详情页面地址，并存储起来，触发消费者事件
 - 消费者循环处理所有的闲情页面地址，处理完毕以后再触发生产者事件
 - 生产者所有列表页面地址解析完毕，消费者所有闲情地址处理完毕退出

```javascript
const Crawler = require('crawler');
const cheerio = require('cheerio');
const EventEmitter = require('events');


const dateRegex = /[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}/;
const movies = [];
const listPages = [];
const LIST_PAGE_PREFIX = "http://www.dytt8.net/html/gndy/dyzz/";
const DETAIL_PAGE_PREFIX = "http://www.dytt8.net";

let insertCount = 0;
let listPageSize = 0;
let corruntListPage = 0;
let emitter = new EventEmitter();

console.time("耗时：")
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
                insertCount++;
                console.log(`============== 第${insertCount}次爬取电影详情页面 ${res.request.uri.href} ==============`)

                const $ = cheerio.load(res.body,{decodeEntities: false});
                parseDetailPage($,movie);
                done();
            }
        }]);
    }
    emitter.emit('parseListPage')
});

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

    console.log(movie)
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


crawler.queue('http://www.dytt8.net/html/gndy/dyzz/index.html');
/**
 * 爬取结束的回调
 */
crawler.on('drain',function(){
    console.log(`存储电影${insertCount}个，爬取列表页面${corruntListPage}`)
    console.timeEnd("耗时：")
});
```

上边的代码其实已经是一个完整的爬虫了，执行代码，我取最后两行的打印结果如下，加上第一个页面一共`1+173+4301 = 4475`个页面，不到270s,效率算不错了。

```
存储电影4301个，爬取列表页面173
耗时：: 269829.002ms
```

## 最后一步 数据持久化
因为node原生的mysql驱动需要写SQL，我不想写，所以选择了MongoDb作为存储介质。实际使用起来还是非常的合适，因为我们的爬虫也不会涉及到事务和数据之间的强关联。所以使用NoSql数据库是个非常正确的选择。

MongoDb有第三方封装好了的包`mongoose`老规矩，先贴文档`http://mongoosejs.com/docs/middleware.html`和github地址`https://github.com/Automattic/mongoose`。但是，我并不打算使用它，我觉原生的就够了的mongodb官方提供的驱动`mongodb`,文档`http://mongodb.github.io/node-mongodb-native/3.0/api/`。具体怎么用，也不是本文重点，这里提供一个mongoDb增删改查的例子。

### mongodb使用示例

```
const MongoClient = require('mongodb').MongoClient;
const url = "mongodb://localhost:27017/spider";
const connectDb = function (MongoClient, url) {
    return new Promise(function (resolve, reject) {
        MongoClient.connect(url, function (err, db) {
            if (err) {
                console.log("连接失败")
                return reject(err);
            }
            resolve(db);
            console.log("连接成功")
        });
    });
};
const insertDate = async function (collectionName,obj) {
    const db = await connectDb(MongoClient, url);
    const dbase = db.db("remote");

    if(obj instanceof Array){
        dbase.collection(collectionName).insertMany(obj, function(err, res) {
            if (err) throw err;
            console.log("文档插入成功");
            db.close();
        });
    }else{
        dbase.collection(collectionName).insertOne(obj, function(err, res) {
            if (err) throw err;
            console.log("文档插入成功");
            db.close();
        });
    }

};
let obj = {
    name: "张三",
    age: "18"
};
// insertDate('test',obj);
let objs = [{
    name: "王五",
    age: "28"
},{
    name: "赵六",
    age: "82"
}];
// insertDate('test',objs);



const find  = async function (filter) {
    const db = await connectDb(MongoClient, url);
    const dbase = db.db("remote");
    dbase.collection("test").find(filter).toArray(function (err, result) {
        console.log(result)
        db.close()
    })
}

// find();
// find({"name" : "张三"})


const update = async function(type,filter,update){
    const db = await connectDb(MongoClient, url);
    const dbase = db.db("remote");
    if(type === "updateOne"){
        dbase.collection('test').updateOne(filter,update,function (err, result) {
            console.log(`修改条数：${result.result.nModified}`)
            db.close()
        })
    }else{
        dbase.collection('test').updateMany(filter,update,function (err, result) {
            console.log(`修改条数：${result.result.nModified}`)
            db.close()
        })

    }
}

// update('updateOne',{"name" : "张三"},{$set : {"url":"http://www.qiangshuidiyu.xin"}});
// update('updateMany',{"name" : "张三"},{$set : {"url":"http://blog.qiangshuidiyu.xin"}});

const del = async function (type,filter) {
    const db = await connectDb(MongoClient, url);
    const dbase = db.db("remote");
    if(type === 'deleteOne'){
        dbase.collection('test').deleteOne(filter,function (err, result) {
            console.log(`删除条数：${result.deletedCount}`)
            db.close()
        })
    }else{
        dbase.collection('test').deleteMany(filter,function (err, result) {
            console.log(`删除条数：${result.deletedCount}`)
            db.close()
        })
    }

}
/*
del('deleteOne',{name : "王五"});
del('deleteMany',{name : "王五"});*/


const sortAndLimit = async function (sort,limit,skip) {
    const db = await connectDb(MongoClient, url);
    const dbase = db.db("remote");
    dbase.collection('test').find().sort(sort).skip(skip).limit(limit).toArray(function (err, result) {
        console.log("=====================")
        console.log(result)
        console.log("=====================")
    })
};

let sort = {
    age : 1 // 1-正序，2-倒序
};

// sortAndLimit(sort,5,2);

const lookUp = async function () {
    const db = await connectDb(MongoClient, url);
    const dbase = db.db("remote");
    dbase.collection('test').aggregate([
        {
            $lookup:{
                from: 'test2', //右集合
                localField:'name',//左集合join字段
                foreignField:'name',//右集合join字段
                as:'name' //新生成字段(Array 类型数据)
            }
        }
    ],function (err, res) {
        res.toArray(function(err, documents) {
            console.log(JSON.stringify(documents))
        });
    });
}
lookUp();
```

### 爬取数据存储到数据
鉴于nodejs模块化的思想，我们可以把对mongodb的操作单独的封装在`mongo.js`中，然后在我们的爬虫程序中引用它，由于`mongodb`驱动原生就是使用连接池管理的，所以我们不需要考虑反复的获取释放链接会导致性能下降的问题。贴上我的代码


## 博客地址 http://www.qiangshuidiyu.xin/post/node-spider.html



 
