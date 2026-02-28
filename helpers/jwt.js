const expressJWT = require('express-jwt')

function authJWT(){
    const secret = process.env.secret
    return expressJWT (
        {
            secret,
            algorithms:['HS256'],
            isRevoked: isRevoked
        }
        //this unless block help us to exclude the api we dont want the 
        //the jwt auth to affect
    ).unless({
        path: [
            {url:/\/api\/v1\/product(.*)/, methods: ['GET','OPTIONS'] },
            {url:/\/api\/v1\/categories(.*)/, methods: ['GET','OPTIONS']},
            '/api/v1/user/login',
            '/api/v1/user/register',
        ]
    })
}


async function isRevoked(req,payload,done){
    if(!payload.isAdmin){
        done(null,true)
    }
    done()
}

module.exports = authJWT