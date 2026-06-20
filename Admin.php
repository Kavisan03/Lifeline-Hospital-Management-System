<?php
// src/Models/Admin.php

require_once __DIR__ . '/Database.php';

class Admin {
    private PDO $db;

    public function __construct() {
        $this->db = (new Database())->getConnection();
    }

    /**
     * Authenticate an admin user.
     * 
     * @param string $username
     * @param string $password
     * @return array|null Admin data if valid, null otherwise
     */
    public function login(string $username, string $password): ?array {
        $username = trim($username);
        if (empty($username) || empty($password)) {
            return null;
        }

        $stmt = $this->db->prepare("SELECT id, username, password, role, shift_start, shift_end FROM admins WHERE username = :username");
        $stmt->execute(['username' => $username]);
        $admin = $stmt->fetch();

        if ($admin && password_verify($password, $admin['password'])) {
            // Remove password before returning
            unset($admin['password']);
            return $admin;
        }

        return null;
    }

    /**
     * Fetch all admin accounts.
     * 
     * @return array
     */
    public function getAll(): array {
        $stmt = $this->db->prepare("SELECT id, username, role, shift_start, shift_end FROM admins ORDER BY id DESC");
        $stmt->execute();
        return $stmt->fetchAll();
    }

    /**
     * Register a new admin user.
     * 
     * @param array $data
     * @return int Inserted ID
     * @throws Exception
     */
    public function create(array $data): int {
        $username = trim($data['username'] ?? '');
        $password = $data['password'] ?? '';
        $role = trim($data['role'] ?? '');
        $shiftStart = trim($data['shift_start'] ?? '00:00:00');
        $shiftEnd = trim($data['shift_end'] ?? '23:59:59');

        if (empty($username) || empty($password) || empty($role)) {
            throw new Exception("Username, password, and role are required.");
        }

        if (!in_array($role, ['Super Admin', 'Doctor Admin', 'Desk Admin', 'Support Admin'])) {
            throw new Exception("Invalid admin role.");
        }

        // Validate time formats (H:i:s or H:i)
        if (!preg_match('/^(?:2[0-3]|[01][0-9]):[0-5][0-9](?::[0-5][0-9])?$/', $shiftStart)) {
            $shiftStart = '00:00:00';
        }
        if (!preg_match('/^(?:2[0-3]|[01][0-9]):[0-5][0-9](?::[0-5][0-9])?$/', $shiftEnd)) {
            $shiftEnd = '23:59:59';
        }

        // Check uniqueness
        $check = $this->db->prepare("SELECT id FROM admins WHERE username = :username");
        $check->execute(['username' => $username]);
        if ($check->fetch()) {
            throw new Exception("Username already exists.");
        }

        // Hash password securely
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        $query = "INSERT INTO admins (username, password, role, shift_start, shift_end) 
                  VALUES (:username, :password, :role, :shift_start, :shift_end)";
        
        $stmt = $this->db->prepare($query);
        $stmt->execute([
            'username' => $username,
            'password' => $hashedPassword,
            'role' => $role,
            'shift_start' => $shiftStart,
            'shift_end' => $shiftEnd
        ]);

        return (int)$this->db->lastInsertId();
    }

    /**
     * Check if a given admin role is currently inside their designated shift hours.
     * 
     * @param string $username
     * @return bool
     */
    public function isWithinShift(string $username): bool {
        $stmt = $this->db->prepare("SELECT role, shift_start, shift_end FROM admins WHERE username = :username");
        $stmt->execute(['username' => $username]);
        $admin = $stmt->fetch();

        if (!$admin) {
            return false;
        }

        // Super Admin has 24/7 override access
        if ($admin['role'] === 'Super Admin') {
            return true;
        }

        // Get current system time (Ensure timezone matches local server)
        date_default_timezone_set('Asia/Kolkata'); // Match local metadata +05:30
        $currentTime = date('H:i:s');

        $start = $admin['shift_start'];
        $end = $admin['shift_end'];

        if ($start <= $end) {
            // Single-day shift
            return ($currentTime >= $start && $currentTime <= $end);
        } else {
            // Over-midnight shift (e.g. 22:00:00 to 06:00:00)
            return ($currentTime >= $start || $currentTime <= $end);
        }
    }
}
