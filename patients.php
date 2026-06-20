<?php
// public/api/patients.php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/Admin.php';
require_once __DIR__ . '/Patient.php';

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
    if ($currentRole === 'Doctor Admin') {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Forbidden: Doctor admins cannot register patients.']);
        exit;
    }
}

try {
    $patientModel = new Patient();

    if ($method === 'GET') {
        $patients = $patientModel->getAll();
        echo json_encode([
            'status' => 'success',
            'data' => $patients
        ]);
        exit;
    } 
    
    if ($method === 'POST') {
        // Read input data (handles both form submission and JSON fetch payloads)
        $input = json_decode(file_get_contents('php://input'), true);
        if ($input === null) {
            $input = $_POST;
        }

        $newId = $patientModel->create($input);
        
        echo json_encode([
            'status' => 'success',
            'message' => 'Patient registered successfully.',
            'patient_id' => $newId
        ]);
        exit;
    }

    // Invalid Method
    http_response_code(405);
    echo json_encode([
        'status' => 'error',
        'message' => 'Method Not Allowed'
    ]);

} catch (Exception $e) {
    http_response_code(400); // Bad Request for validation errors
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
