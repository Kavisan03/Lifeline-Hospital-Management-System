<?php
// public/api/appointments.php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/Admin.php';
require_once __DIR__ . '/Appointment.php';

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
        echo json_encode(['status' => 'error', 'message' => 'Forbidden: Doctor admins cannot schedule or update appointments.']);
        exit;
    }
}

try {
    $appointmentModel = new Appointment();

    if ($method === 'GET') {
        $appointments = $appointmentModel->getAll();
        echo json_encode([
            'status' => 'success',
            'data' => $appointments
        ]);
        exit;
    } 
    
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if ($input === null) {
            $input = $_POST;
        }

        $newId = $appointmentModel->create($input);
        
        echo json_encode([
            'status' => 'success',
            'message' => 'Appointment scheduled successfully.',
            'appointment_id' => $newId
        ]);
        exit;
    }

    if ($method === 'PUT' || $method === 'PATCH') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $id = (int)($input['id'] ?? 0);
        $status = trim($input['status'] ?? '');

        if ($id <= 0 || empty($status)) {
            throw new Exception("Appointment ID and new status are required.");
        }

        $success = $appointmentModel->updateStatus($id, $status);

        if ($success) {
            echo json_encode([
                'status' => 'success',
                'message' => "Appointment status updated to '{$status}' successfully."
            ]);
        } else {
            throw new Exception("Failed to update appointment status.");
        }
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
