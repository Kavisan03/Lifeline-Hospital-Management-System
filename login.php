<?php
// public/api/login.php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/Admin.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed']);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input === null) {
        $input = $_POST;
    }

    $username = $input['username'] ?? '';
    $password = $input['password'] ?? '';

    $adminModel = new Admin();
    $admin = $adminModel->login($username, $password);

    if ($admin) {
        // Check if admin is currently within shift hours
        $isWithinShift = $adminModel->isWithinShift($username);
        
        $_SESSION['admin_id'] = $admin['id'];
        $_SESSION['username'] = $admin['username'];
        $_SESSION['role'] = $admin['role'];

        echo json_encode([
            'status' => 'success',
            'message' => 'Login successful.',
            'data' => [
                'username' => $admin['username'],
                'role' => $admin['role'],
                'shift_start' => $admin['shift_start'],
                'shift_end' => $admin['shift_end'],
                'is_within_shift' => $isWithinShift
            ]
        ]);
    } else {
        http_response_code(401);
        echo json_encode([
            'status' => 'error',
            'message' => 'Invalid username or password.'
        ]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
