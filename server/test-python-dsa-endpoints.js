const http = require('http');

async function makePost(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(payload);
    req.end();
  });
}

async function testPythonDSAEndpoints() {
  console.log("=== VERIFYING PYTHON DSA BACKEND INTEGRATION ENDPOINTS ===");

  // 1. Test Python Merge Sort Endpoint
  const sortRes = await makePost('/api/dsa/sort', {
    items: [
      { id: 105, title: 'Zebra' },
      { id: 101, title: 'Alpha' },
      { id: 103, title: 'Mango' }
    ],
    key: 'id'
  });
  console.log("Python Sort Response:", sortRes.success ? "PASS" : "FAIL");

  // 2. Test Python BST Endpoint
  const bstRes = await makePost('/api/dsa/bst', {
    items: [
      { book_id: 201, title: 'Book 201' },
      { book_id: 101, title: 'Book 101' },
      { book_id: 301, title: 'Book 301' }
    ],
    key_field: 'book_id',
    search_key: 101
  });
  console.log("Python BST Response:", (bstRes.success && bstRes.search_result.title === 'Book 101') ? "PASS" : "FAIL");

  // 3. Test Python FIFO Queue Endpoint
  const queueRes = await makePost('/api/dsa/queue', {
    items: [
      { id: 'MEM-1', name: 'Alice' },
      { id: 'MEM-2', name: 'Bob' }
    ],
    remove_id: 'MEM-1'
  });
  console.log("Python Queue Response:", (queueRes.success && queueRes.removed_item.name === 'Alice') ? "PASS" : "FAIL");

  // 4. Test Python Stack Endpoint
  const stackRes = await makePost('/api/dsa/stack', {
    actions: [
      { action: 'LOGIN', user: 'admin' },
      { action: 'ISSUE', book_id: 101 }
    ]
  });
  console.log("Python Stack Response:", (stackRes.success && stackRes.top.action === 'ISSUE') ? "PASS" : "FAIL");
}

testPythonDSAEndpoints();
