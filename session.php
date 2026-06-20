<?php
// public/api/session.php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/Admin.php';

if (isset($_SESSION['username'])) {
    try {
        $adminModel = new Admin();
        
        // Fetch fresh details for shifts
        $db = (new Database())->getConnection();
        $stmt = $db->prepare("SELECT role, shift_start, shift_end FROM admins WHERE username = :username");
        $stmt->execute(['username' => $_SESSION['username']]);
        $details = $stmt->fetch();
        
        $isWithinShift = $adminModel->isWithinShift($_SESSION['username']);

        echo json_encode([
            'status' => 'success',
            'data' => [
                'username' => $_SESSION['username'],
                'role' => $_SESSION['role'],
                'shift_start' => $details['shift_start'] ?? '00:00:00',
                'shift_end' => $details['shift_end'] ?? '23:59:59',
                'is_within_shift' => $isWithinShift
            ]
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
} else {
    http_response_code(401);
    echo json_encode([
        'status' => 'error',
        'message' => 'No active session found.'
    ]);
}
