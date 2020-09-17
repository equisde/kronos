/**
 * 
 * 
 * 
 * Kronos by Carsen Klock 2020, Main app.js
 * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * * KRONOS - DECENTRALIZED APPLICATION AND LAN SERVER
 * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * 
 *  _        _______  _______  _        _______  _______ 
 * | \    /\(  ____ )(  ___  )( (    /|(  ___  )(  ____ \
 * |  \  / /| (    )|| (   ) ||  \  ( || (   ) || (    \/
 * |  (_/ / | (____)|| |   | ||   \ | || |   | || (_____ 
 * |   _ (  |     __)| |   | || (\ \) || |   | |(_____  )
 * |  ( \ \ | (\ (   | |   | || | \   || |   | |      ) |
 * |  /  \ \| ) \ \__| (___) || )  \  || (___) |/\____) |
 * |_/    \/|/   \__/(_______)|/    )_)(_______)\_______)
 *
 *
 * Kronos Module dependencies.
 * 
 * 
 * 
 */
const express = require('express');
const compression = require('compression');
const session = require('express-session');
const bodyParser = require('body-parser');
const logger = require('morgan');
const errorHandler = require('errorhandler');
const lusca = require('lusca');
const dotenv = require('dotenv');
const flash = require('express-flash');
const flashc = require('connect-flash');
const path = require('path');
const expressStatusMonitor = require('express-status-monitor');
const multer = require('multer');
const bitcoin = require('bitcoin');
const WAValidator = require('wallet-address-validator');
const QRCode = require('qrcode');
const base32 = require('thirty-two');
const sprintf = require('sprintf-js');
const unirest = require('unirest');
const tribus = require('tribus-hashjs');
const si = require('systeminformation');
const ProgressBar = require('progressbar.js');
const toastr = require('express-toastr');
const upload = multer({ dest: path.join(__dirname, 'uploads') });
const ip = require('ip');
const shell = require('shelljs');
const fs = require('fs');
const dbr = require('./db.js');
const appRoot = require('app-root-path');
const files = require('fs');
const db = dbr.db;
const gritty = require('gritty');
const rateLimit = require("express-rate-limit");
const randomstring = require("randomstring");

const randosecret = randomstring.generate(42);
const randosess = randomstring.generate(42);
const secretenv = files.readFileSync('./.senv', 'utf-8');
const sessenv = files.readFileSync('./.sen', 'utf-8');

if (secretenv == '') {
  files.writeFileSync('./.senv', 'SECRET_KEY='+randosecret);
}

if (sessenv == '') {
  files.writeFileSync('./.sen', 'SESSION_SECRET='+randosess);
}

//Empty .senv on release to git

// const https = require('https');


//Print in console your LAN IP
console.log('Your LAN', ip.address());

/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
//dotenv.load({ path: '.env' });

dotenv.config({ path: '.env' });

// var privateKey  = fs.readFileSync('./ssl/kronos.key', 'utf8');
// var certificate = fs.readFileSync('./ssl/kronos.crt', 'utf8');

// var credentials = {key: privateKey, cert: certificate};

/**
 * Controllers (route handlers).
 */
const kronosController = require('./controllers/kronos');
const dashController = require('./controllers/dashboard');
const toolsController = require('./controllers/tools');
const walletController = require('./controllers/wallet');

/**
 * Create Express server.
 */
const app = express();

const server = require('http').Server(app);
//const httpsserver = require('https').createServer(credentials, app);
const io = require('socket.io')(server);
const sharedsession = require("express-socket.io-session");
io.setMaxListeners(33); 
const port = 3000;

/**
 * Express configuration.
 */
//app.set('port', port);

app.set('views', path.join(__dirname, 'views'));

app.set('view engine', 'pug');

app.use(expressStatusMonitor());

app.use(compression());

app.use(logger('dev'));

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: true }));

app.use(flash());

//app.use(lusca.xframe('ALLOW-FROM 127.0.0.1'));

app.use(lusca.xssProtection(true));

app.use((req, res, next) => {
  res.io = io;
  //Emit to our Socket.io Server for Notifications
  let socket_idx = [];
  res.io.on('connection', function (socket) {

    socket_idx.push(socket.id);

    if (socket_idx[0] === socket.id) {
      // remove the connection listener for any subsequent 
      // connections with the same ID
      res.io.removeAllListeners('connection');
    }

    //socket.emit("notifications", {notifydb: notifydata});

    var notifydb;
    var thedir = appRoot + '/notifies.txt';
    var thedb = files.readFileSync(thedir).toString();
    
    if (thedb == '') {
      notifydb = '';
    } else {
      notifydb = thedb;      

      console.log("IM EMITTING WEEFEEEE");

      socket.emit("notifications", {notifydb: notifydb});

      files.writeFile('notifies.txt', '', function (err) {
        if (err) throw err;
        console.log('Notification Cleared!');
      });

    }

    const asyncFun = async() => {
      var notifydb;
      var thedir = appRoot + '/notifies.txt';
      var thedb = await files.readFileSync(thedir).toString();
      
      if (thedb == '') {
        notifydb = '';
      } else {
        notifydb = thedb;   
    
        console.log("INTERVAL RUNNING ON SOCKET EMIT");
      
        socket.emit("notifications", {notifydb: notifydb});
      
        files.writeFile('notifies.txt', '', function (err) {
          if (err) throw err;
          console.log('Notification Cleared!');
        });

      }   

    }

    setInterval(() => {asyncFun();}, 3000);
  });
  next();
});

app.use(flashc());

const SESSION_SECRET = files.readFileSync('./.sen', 'utf-8'); //process.env.SESSION_SECRET

const sess = session({
  secret: SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  unset: 'destroy',
  name: 'KronosAuth',
  cookie: {
      maxAge: (1000 * 60 * 60 * 24) // default is 1 day
  }
});

//New Auth Sharing Session with Sockets.io
app.use(sess);

io.use(sharedsession(sess)); 

app.set('trust proxy',1);
 
// Load express-toastr
// You can pass an object of default options to toastr(), see example/index.coffee
app.use(toastr());

app.use(function (req, res, next)
{
    res.locals.toasts = req.toastr.render()
    next()
});

app.use(gritty()); //Gritty...

app.use(express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }));

var auth = function(req,res,next){
  if (!req.session.loggedin){
      //console.log('You are NOT AUTHED');
      return res.redirect("/login");
      //return res.render('login', { title: 'Kronos Login'});
  } else {
      //console.log('You are AUTHED');
      return next();
  }
};

var authseed = function(req,res,next){
  if (!req.session.loggedin2){
      //console.log('You are NOT AUTHED');
      return res.redirect("/auth");
      //return res.render('login', { title: 'Kronos Login'});
  } else {
      //console.log('You are AUTHED');
      return next();
  }
};

var authterm = function(req,res,next){
  if (!req.session.loggedin3){
      //console.log('You are NOT AUTHED');
      return res.redirect("http://" + ip.address() + ":3000/autht");
      //return res.render('login', { title: 'Kronos Login'});
  } else {
      //console.log('You are AUTHED');
      return next();
  }
};

var authtermpop = function(req,res,next){
  if (!req.session.loggedin4){
      //console.log('You are NOT AUTHED');
      return res.redirect("http://" + ip.address() + ":3000/authk");
      //return res.render('login', { title: 'Kronos Login'});
  } else {
      //console.log('You are AUTHED');
      return next();
  }
};

//Damn Terminal Sockets running on port 3300
gritty.listen(io, {
  prefix: '/gritty',
});
 
const Limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50 // Max 50 Requests
});

const TXLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100 // Max 100 Requests
});

/**
 * Primary app routes.
 */

//Kronos Controller
app.get('/login', Limiter, kronosController.login);
app.get('/auth', auth, Limiter, kronosController.auth);
app.get('/autht', auth, Limiter, kronosController.autht);
app.get('/authk', auth, Limiter, kronosController.authk);
app.get('/logout', kronosController.logout);

//POST Routes for kronosController
app.post('/login', Limiter, kronosController.postlogin);
app.post('/create', Limiter, kronosController.create);
app.post('/setup', Limiter, kronosController.setup);
app.post('/auth', auth, Limiter, kronosController.postAuth);
app.post('/autht', auth, Limiter, kronosController.postAutht);
app.post('/authk', auth, Limiter, kronosController.postAuthk);
app.post('/unlock', auth, kronosController.unlock);
app.post('/unlockstaking', auth, kronosController.unlockstaking);
app.post('/lock', auth, kronosController.lock);
app.post('/encrypt', auth, kronosController.encrypt);
app.post('/reboot', auth, kronosController.reboot);
app.post('/privkey', auth, kronosController.privkey);
app.post('/walletnotify', TXLimiter, kronosController.notification);

//Tools Controller
app.get('/ddebug', auth, toolsController.getDebugLog);
app.get('/settings', auth, Limiter, toolsController.getSettings);
app.get('/terminal', auth, authterm, Limiter, toolsController.terminal);
app.get('/termpop', auth, authtermpop, Limiter, toolsController.termPop);

//DashBoard Controller
app.get('/', auth, dashController.index);
app.post('/', auth, dashController.index);


// Wallet Controller
/////////////////////
// D Explorer Routes
app.get('/tx/:tx', auth, walletController.gettx);
app.get('/block/:block', auth, walletController.getblock);
app.get('/address/:addr', auth, walletController.getaddress);

//POST Routes for WalletController
app.post('/newaddress', auth, walletController.address);
app.post('/startfs', auth, walletController.startfs);
app.post('/getnewaddress', auth, walletController.address);
app.post('/getgenkey', auth, walletController.genkey);
app.post('/withdraw/send', auth, walletController.withdraw);
app.post('/sendrawtx', auth, walletController.sendRaw);
app.post('/search', auth, walletController.search);

//GET Routes for WalletController
app.get('/addresses', auth, walletController.addresses);
app.get('/transactions', auth, walletController.transactions);
app.get('/peers', auth, walletController.peers);
app.get('/fs', auth, walletController.fs);
app.get('/withdraw', auth, walletController.getWithdraw);
app.get('/rawtx', auth, walletController.getRaw);
app.get('/seed', auth, authseed, walletController.getSeed);

app.get('/genmini', auth, walletController.genMini);
app.get('/convertmini', auth, walletController.convertMini);

//KeepKey Routes
app.get('/keepkey', auth, walletController.keepkey);
app.post('/keepkeyaddr', auth, walletController.xpub);

//Other POST and GET Routes for WalletController
app.get('/import', auth, walletController.getPriv);
app.post('/importpriv', auth, walletController.importPriv);

app.get('/sign', auth, walletController.getSign);
app.post('/signmsg', auth, walletController.signMsg);

app.get('/verify', auth, walletController.getVerify);
app.post('/verifymsg', auth, walletController.verifyMsg);

app.get('/backup', auth, walletController.getBackup);
app.post('/backupwallet', auth, walletController.backupWallet);

/**
 * Error Handler.
 */
app.use(errorHandler());

/**
 * Start Express server.
 */
app.listen(port, '0.0.0.0', () => {
  var tri = tribus.digest('Denarius');
  console.log('✓ Tribus Hash of "Denarius"', tri);
  console.log('✓ Kronos Interface is running at http://' + ip.address() + ':%d', '3000', app.get('env'));
  console.log('✓ Open the URL above in your web browser on your local network to start using Kronos!\n');
});


module.exports = {app: app, server: server};

//The 404 Route (ALWAYS Keep this as the last route)
app.get('*', function (req, res) {
    res.status(404).render('404_error');
});
