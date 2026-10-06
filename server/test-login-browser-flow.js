const http = require('http');

async function sendRequest(hostname, port, path, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request({
      hostname,
      port,
      path,
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data, headers: res.headers });
        }
      });
    });

    req.on('error', err => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

async function runBrowserLoginVerification() {
  console.log("=== EXECUTING FRONTEND <-> BACKEND LOGIN FLOW VERIFICATION ===");
  let consoleErrors = 0;
  let networkErrors = 0;

  // 1. Backend Connection Check
  let backendConnection = "FAIL";
  try {
    const res = await sendRequest('localhost', 3000, '/api/auth/me', 'GET');
    if (res.status === 200 || res.status === 401) {
      backendConnection = "PASS";
    }
  } catch (e) {
    networkErrors++;
    console.error("Backend Connection Error:", e.message);
  }

  // 2. Cross-Origin / Live Server CORS Preflight Test
  let corsPass = false;
  try {
    const corsRes = await sendRequest('localhost', 3000, '/api/auth/login', 'OPTIONS', null, {
      'Origin': 'http://127.0.0.1:5500',
      'Access-Control-Request-Method': 'POST'
    });
    if (corsRes.headers['access-control-allow-origin']) {
      corsPass = true;
    }
  } catch (e) {
    networkErrors++;
  }

  // 3. API Request & Valid Credentials Auth
  let apiRequest = "FAIL";
  let databaseAuth = "FAIL";
  let validLoginPass = false;
  try {
    const res = await sendRequest('localhost', 3000, '/api/auth/login', 'POST', {
      username: 'admin@lumina.edu',
      password: 'lumina2026'
    }, {
      'Origin': 'http://localhost:5500'
    });

    if (res.status === 200 && res.data && res.data.success && res.data.token) {
      apiRequest = "PASS";
      databaseAuth = "PASS";
      validLoginPass = true;
    } else {
      consoleErrors++;
    }
  } catch (e) {
    networkErrors++;
    console.error("Login API Request Error:", e.message);
  }

  // 4. Invalid Password Rejection Test
  let wrongPasswordTest = "FAIL";
  try {
    const res = await sendRequest('localhost', 3000, '/api/auth/login', 'POST', {
      username: 'admin@lumina.edu',
      password: 'wrong_password_12345'
    }, {
      'Origin': 'http://localhost:5500'
    });

    if (res.status === 401 && res.data && res.data.success === false) {
      wrongPasswordTest = "PASS";
    } else {
      consoleErrors++;
    }
  } catch (e) {
    networkErrors++;
  }

  const overallLoginTest = (validLoginPass && wrongPasswordTest === "PASS" && databaseAuth === "PASS") ? "PASS" : "FAIL";

  console.log("\n==============================================");
  console.log(`LOGIN TEST: ${overallLoginTest}`);
  console.log(`BACKEND CONNECTION: ${backendConnection}`);
  console.log(`API REQUEST: ${apiRequest}`);
  console.log(`DATABASE AUTH: ${databaseAuth}`);
  console.log(`WRONG PASSWORD TEST: ${wrongPasswordTest}`);
  console.log(`CONSOLE ERRORS: ${consoleErrors}`);
  console.log(`NETWORK ERRORS: ${networkErrors}`);
  console.log("==============================================");
}

runBrowserLoginVerification();
