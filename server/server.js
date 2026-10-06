// Canonical compatibility launcher for the Lumina Library backend.
// All normal starts use the complete production backend so there is only one
// backend implementation and no feature drift between server entry points.
require('./server-complete.js');
