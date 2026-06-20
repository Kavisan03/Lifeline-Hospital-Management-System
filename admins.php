<?php
// public/api/admins.php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/Admin.php';

// Authentication Check: Must be logged in
if (!isset($_SESSION['username'])) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized: Please log in first.']);
    exit;
}

// Role-Based Access Check: Only Super Admin can manage other admins
if ($_SESSION['role'] !== 'Super Admin') {
    http_response_code(403);
    echo json_encode(['status' => 'error', 'message' => 'Forbidden: Only Super Admin can access admin management.']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

try {
    $adminModel = new Admin();

    // Check shift validation for the active user as well
    if (!$adminModel->isWithinShift($_SESSION['username'])) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Access Denied: You are outside your assigned shift hours.']);
        exit;
    }

    if ($method === 'GET') {
        $admins = $adminModel->getAll();
        echo json_encode([
            'status' => 'success',
            'data' => $admins
        ]);
        exit;
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if ($input === null) {
            $input = $_POST;
        }

        $newId = $adminModel->create($input);

        echo json_encode([
            'status' => 'success',
            'message' => 'Admin registered successfully.',
            'admin_id' => $newId
        ]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed']);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
