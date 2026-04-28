const express      = require('express');
const { openStream } = require('../controllers/streamController');

const router = express.Router();

// No protect middleware — auth handled inside openStream via query param token
// because the browser's native EventSource does not support custom headers.
router.get('/', openStream);

module.exports = router;
