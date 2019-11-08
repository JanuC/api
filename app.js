const express = require('express')
const app = express()

// 导入jsonwebtoken,用于生成token
const jwt = require('jsonwebtoken')


// 导入 cors,为跨域所用
const cors = require('cors')
app.use(cors())

// 解析表单的插件
const bodyParser = require('body-parser')
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: false
}))




// 通过连接池创建数据库连接对象
// 如果是通过 createConnection 方法连接数据库,每次执行query方法都是一次全新的连接
// 会造成很大的资源浪费,降低性能
// 通过 createPool 使用连接池的方式连接数据库,它一次性创建了多个连接,然后通过客户端
// 的查询,自动的分发,复用,管理这些连接
const mysql = require('mysql')
const pool = mysql.createPool({
  host: '47.100.36.233:3006',
  user: 'januweb',
  password: 'cy641578178',
  database: 'januweb',
  multipleStatements: true,
})

// const pool = mysql.createPool({
//   host: '47.100.36.233',
//   user: 'root',
//   password: 'root',
//   database: 'januweb',
//   multipleStatements: true,
// })


// 对操作数据库的query方法通过 axync和 await 进行封装
let query = function(sqlStr) {
  // async/await 需要返回一个 promise对象
  return new Promise((reslove,reject) => {
    pool.getConnection((err,connection) => {
      if(err) {
        reject(err)
      }else {
        connection.query(sqlStr,(err,results) => {
          if(err) {
            reject(err)
          }else {
            reslove(results)
          }
          // 结束会话
          connection.release()
        })
      }
    })
  })
}

// 后台登录功能
app.post('/api/login',async (req,res) => {
  const data = req.body
  const sqlStr = `select * from admin where username = '${data.username}'`
  const results = await query(sqlStr)
  if(results.length != 0) {
    // 用户名存在
    // 判断密码是否正确
    if(results[0].password === data.password) {
      // 密码正确
      // 用jsonwebtoken 生成token
      let content = {username: data.username,admin: true} // 生成的token的主体信息
      let secret = 'I_LOVE_SUXINYU' // 密匙
      let token = jwt.sign(content,secret,{
        expiresIn: 60 * 60 * 1 //1小时后过期
      })
      
      // 将token存储在数据库中
      const updateSqlStr = `update admin set token = '${token}' where id = ${results[0].id}`
      const r_update = await query(updateSqlStr)
      if(r_update) {
        res.json({
          code: 200,
          message: '登录成功',
          data: {id: results[0].id,username: results[0].username,token: token}
        })
      }
    }else {
      // 密码错误
      res.json({
        code: 202,
        message: '密码错误'
      })
    }
  }else {
    // 用户名不存在
    res.json({
      code: 201,
      message: '用户名不存在'
    })
  }
})

// 验证 token 的合法性

app.post('/api/checkuser',async (req,res) => {
  let data = req.body
  const sqlStr = `select * from admin where username = '${data.username}'`
  const results = await query(sqlStr)
  // console.log(results);
  if(results.length != 0) {
    // 用户名存在
    let token = data.token // 传过来的token
    let secret = 'I_LOVE_SUXINYU' // 密钥
    jwt.verify(token,secret,(err,msg) => {
      if(err) {
        // token已失效或者伪造的token
        res.json({
          status: false
        })
      }else {
        res.json({
          status: true
        })
      }
    })
  }else {
    // 用户名不存在
    res.json({
      code: 201,
      message: '用户名不存在'
    })
  }
})

// 获取文章列表
app.post('/api/getarticle',async (req,res) => {
  const sqlStr = 'select * from article'
  const results = await query(sqlStr)
  if(results.length != 0) {
  res.json({
    code: 200,
    message: '操作成功',
    articlelist: results
  })
}
})


// 发表文章 或 保存草稿
app.post('/api/newarticle',async (req,res) => {
  let data = req.body
  // 获取服务器当前时间戳
  console.log(data);
  
  let date = Date.parse(new Date())
  // sql语句
  let sqlStr = `insert into article (title,main,category,isshow,ispublish,updatetime)
  values ('${data.title}','${data.main}','${data.category}','${data.isshow}',
  '${data.ispublish}','${date}')`
  const results = await query(sqlStr)
  if(results) {
    // 操作成功,查询所有文章并返回
    const sqlStr = 'select * from article'
    const s_res = await query(sqlStr)
    if(s_res) {
      // 查询成功
      // 判断是发表还是保存草稿
      if(data.ispublish) {
        // 发布
        res.json({
          code: 200,
          message: '发表成功',
          data: s_res
        })
      }else {
        // 保存草稿
        res.json({
          code: 200,
          message: '保存草稿成功',
          data: s_res
        })
      }

    }else {
      res.json({
        code: 201,
        message: '操作失败'
      })
    }
  }
})

// 删除文章功能
app.post('/api/delarticle',async (req,res) => {
  let id = req.body.id
  const sqlStr = `delete from article where id = ${id}`
  const results = await query(sqlStr)
  // console.log(results);
  
  if(results) {
    // 操作成功
    // 获取所有文章,并返回
    const sqlStr = 'select * from article'
    let r_s = await query(sqlStr)
    // console.log(r_s);
    
    if(r_s) {
      res.json({
        code: 200,
        message: '删除成功',
        data: r_s
      })
    }else {
      res.json({
        code: 201,
        message: '操作失败'
      })
    }
  }
})

// 更新文章功能
app.post('/api/updatearticle',async (req,res) => {
  let id = req.body.id
  console.log(req.body);
  // 获取当前时间戳
  let date = Date.parse(new Date())
  let sqlStr = `update article set title = '${req.body.title}',main='${req.body.main}',
  category = '${req.body.category}',isshow='${req.body.isshow}',ispublish='${req.body.ispublish}',
  updatetime = '${date}' where id = ${req.body.id} `
  let results = await query(sqlStr)
  if(results) {
    let sqlStr = 'select * from article'
    let s_r = await query(sqlStr)
    if(s_r) {
      res.json({
        code: 200,
        message: '保存成功',
        data: s_r
      })
    }
  }
})

// 退出功能
app.post('/api/logout',async (req,res) => {
  // 发送请求,将token置为空
  let username = req.body.username
  let sqlStr = `update admin set token = '' where username = '${username}'`
  let results = await query(sqlStr)
  if(results) {
    res.json({
      code: 200,
      message: '退出成功'
    })
  }else {
    res.json({
      code: 201,
      message: '操作失败'
    })
  }
})

app.listen(3001,() => {
  console.log('http://192.168.31.19:3001');
})



