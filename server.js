const express = require('express');
const app = express();
const http = require('http').Server(app);
http.listen('3002', function () {
	console.log('web server is running at port:3002......');
});

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
	extended: false
}));
// parse application/json
app.use(bodyParser.json());
// const urlencodedParser = bodyParser.urlencoded({extended: false});

app.use(express.static('public')); //静态文件，如CSS、图片等放到/public文件夹里

/********************************************** 连接数据库 **************************************************************/
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('maindb.db');

/********************************************** 设置session，存储用户名 **************************************************************/
const session = require('express-session');
// app.use(cookieParser());
app.use(session({
	secret: 'unitLogin',
	cookie: {
		maxAge: 6000000000, //value值为数字，之前设置成了字符串，坑死~
	},
	resave: false,
	saveUninitialized: true,
}));

/********************************************** 页面路由 ***************************************************************/
{
	// 首页&&登录页
	app.get('/', (req, res) => {
		res.sendFile(`${__dirname}/index.html`);
	});

	// 测试数据列表
	app.get('/testdata', (req, res) => {
		res.sendFile(`${__dirname}/testdata.html`);
	});

	// 人员信息列表
	app.get('/person', (req, res) => {
		res.sendFile(`${__dirname}/person.html`);
	});

	// 系统设置页面
	app.get('/sysconfig', (req, res) => {
		res.sendFile(`${__dirname}/sysconfig.html`);
	});

	// 新增页面
	app.get('/add', (req, res) => {
		res.sendFile(`${__dirname}/add.html`);
	});

	// 帮助说明页面
	app.get('/help', (req, res) => {
		res.sendFile(`${__dirname}/help.html`);
	});
}

/********************************************** 数据操作 ****************************************************************/
{
	// 登录验证
	app.post('/login', (req, res) => {
		let uuid = req.body.login_name;
		let pwd = req.body.login_pwd;
		db.all("select pwd from Unit where UUID = '" + uuid + "'", (err, rows) => {
			console.log(rows);
			if (err) {
				console.log(err);
				return;
			}
			if (rows.length === 0) {
				return res.send('noUser');
			}
			if (rows[0].pwd !== pwd) {
				return res.send('errPwd');
			}
			req.session.username = uuid;
			return res.send('success');
		})
	});

	// 体测数据初始化
	app.get('/tcDataQuery', (req, res) => {
		db.all('select * from ResultFIT order by TestDate desc', (err, rows) => {
			if (err) {
				console.log(err);
			} else {
				return res.json(rows);
			}
		})
	});

	// 体成分数据初始化
	app.get('/tcfDataQuery', (req, res) => {
		db.all('select * from Result order by TestDate desc', (err, rows) => {
			if (err) {
				console.log(err);
			} else {
				return res.json(rows);
			}
		})
	});

	// 测试数据搜索
	app.get('/searchData', (req, res) => {
		let testid = req.query.testid;
		let isActive = Number(req.query.isActive);
		let table = isActive ? 'Result' : 'ResultFIT';
		console.log(testid, isActive, table, typeof isActive);
		db.all(`select * from ${table} where TestID like '%${testid}%' or Name like '%${testid}%'`, (err, rows) => {
			if (err) {
				console.log(err);
			} else {
				if (rows.length === 0) {
					return res.send('noData');
				} else {
					return res.json(rows);
				}
			}
		})
	});

	// 删除数据
	app.get('/delData', (req, res) => {
		let del_id = req.query;
		let arr = [];
		let table = '';
		for (let key in del_id) {
			if(key === 'isActive'){
				table = Number(del_id[key]) ? 'Result' : 'ResultFIT';
				continue;
			}
			arr.push(key);
		}
		let index_str = `(${arr.join(',')})`;
		console.log(index_str,table);
		let del_sql = db.prepare('delete from ' + table + ' where TestID in ' + index_str);
		del_sql.run((err, rows) => {
			if (!err) {
				return res.send('OK');
			} else {
				console.log(err);
				return res.send('FAIL');
			}
		});
		del_sql.finalize();
	});

	// 人员初始化
	app.get('/initPerson', (req, res) => {
		console.log(req.session.username);
		db.all("select * from person", function (err, rows) {
			if (!err) {
				return res.json(rows);
			}
			else {
				console.log(err);
			}
		});
	});

	// 人员新增
	app.post('/savePerson', (req, res) => {
		let uuid = req.session.username,
			uid = req.body.uid,
			name = req.body.name,
			sex = req.body.sex,
			birthyear = Number(req.body.birthyear),
			height = Number(req.body.height).toFixed(1),
			phone = req.body.phone,
			note = req.body.note,
			state = req.body.state;
		let save_sql = state === '0' ? db.prepare('insert into Person(UUID,UID,Name,Sex,BirthYear,Height,Phone,Note) values(?,?,?,?,?,?,?,?)') : db.prepare('update Persen set uuid = ?,uid=?,name=?,sex=?,birthyear=?,height=?,phone=?,note=?');

		save_sql.run(uuid, uid, name, sex, birthyear, height, phone, note, function (err, rows) {
			if (err) {
				console.log(err);
				return res.send('fail');
			} else {
				return res.send('success');
			}
		});
		save_sql.finalize();
	});

	// 人员删除
	app.get('/delPerson', (req, res) => {
		let del_id = req.query;
		let arr = [];
		for (let key in del_id) {
			arr.push(key);
		}
		let index_str = `(${arr.join(',')})`;
		console.log(index_str);
		let del_sql = db.prepare('delete from Person where ID in ' + index_str);
		del_sql.run((err, rows) => {
			if (!err) {
				return res.send('OK');
			} else {
				console.log(err);
				return res.send('FAIL');
			}
		});
		del_sql.finalize();
	});

	// 人员查询
	app.get('/searchPerson', (req, res) => {
		db.all("select * from Person where UID like '%" + req.query.person_uid + "%' and Name like '" + req.query.person_name + "%'",(err, rows) => {
			if(!err){
				if(rows.length === 0){
					return res.send('noPerson');
				}else {
					return res.json(rows);
				}
			}else {
				console.log(err);
			}
		})
	});
}