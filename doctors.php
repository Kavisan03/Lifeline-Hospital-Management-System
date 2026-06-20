<?php
// public/api/doctors.php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/Admin.php';
require_once __DIR__ . '/Doctor.php';

// Session authentication check
if (!isset($_SESSION['username'])) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized: Please log in first.']);
    exit;
}

$adminModel = new Admin();
$currentUser = $_SESSION['username'];
$currentRole = $_SESSION['role'];

// Shift hours validation check
if (!$adminModel->isWithinShift($currentUser)) {
    http_response_code(403);
    echo json_encode(['status' => 'error', 'message' => 'Access Denied: You are currently outside your assigned shift hours.']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

// RBAC controls
if ($method !== 'GET') {
    if ($currentRole === 'Support Admin') {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Forbidden: Support admins have read-only access.']);
        exit;
    }
    if ($currentRole === 'Desk Admin') {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Forbidden: Desk admins cannot register doctors.']);
        exit;
    }
}

try {
    $doctorModel = new Doctor();

    if ($method === 'GET') {
        $doctors = $doctorModel->getAll();
        echo json_encode([
            'status' => 'success',
            'data' => $doctors
        ]);
        exit;
    } 
    
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if ($input === null) {
            $input = $_POST;
        }

        $newId = $doctorModel->create($input);
        
        echo json_encode([
            'status' => 'success',
            'message' => 'Doctor registered successfully.',
            'doctor_id' => $newId
        ]);
        exit;
    }

    http_response_code(405);
    echo json_encode([
        'status' => 'error',
        'message' => 'Method Not Allowed'
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
