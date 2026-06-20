<?php
// src/config.php

// Auto-detect environment (local vs production hosting)
$isLocal = false;
if (isset($_SERVER['HTTP_HOST'])) {
    $host = $_SERVER['HTTP_HOST'];
    if ($host === 'localhost' || strpos($host, 'localhost:') === 0 || $host === '127.0.0.1') {
        $isLocal = true;
    }
} else if (isset($_SERVER['SERVER_NAME']) && $_SERVER['SERVER_NAME'] === 'localhost') {
    $isLocal = true;
}

if ($isLocal) {
    // Localhost XAMPP / WAMP Settings
    define('DB_HOST', 'localhost');
    define('DB_NAME', 'hospital_db');
    define('DB_USER', 'root');
    define('DB_PASS', ''); // Default XAMPP/WAMP MySQL password is empty
} else {
    // Production InfinityFree Settings
    define('DB_HOST', 'sql213.infinityfree.com');
    define('DB_NAME', 'if0_42223340_hospital_db');
    define('DB_USER', 'if0_42223340');
    
    define('DB_PASS', 'hospital369');
}
