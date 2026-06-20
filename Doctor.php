<?php
// src/Models/Doctor.php

require_once __DIR__ . '/Database.php';

class Doctor {
    private PDO $db;

    public function __construct() {
        $this->db = (new Database())->getConnection();
    }

    /**
     * Fetch all doctors.
     * 
     * @return array
     */
    public function getAll(): array {
        $stmt = $this->db->prepare("SELECT id, first_name, last_name, email, phone, specialization, created_at FROM doctors ORDER BY id DESC");
        $stmt->execute();
        return $stmt->fetchAll();
    }

    /**
     * Create a new doctor record.
     * 
     * @param array $data
     * @return int Inserted ID
     * @throws Exception
     */
    public function create(array $data): int {
        // Validate inputs
        $firstName = trim($data['first_name'] ?? '');
        $lastName = trim($data['last_name'] ?? '');
        $email = trim($data['email'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $specialization = trim($data['specialization'] ?? '');

        if (empty($firstName) || empty($lastName) || empty($email) || empty($phone) || empty($specialization)) {
            throw new Exception("All doctor fields are required.");
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new Exception("Invalid email format.");
        }

        // Check if email already exists
        $checkStmt = $this->db->prepare("SELECT id FROM doctors WHERE email = :email");
        $checkStmt->execute(['email' => $email]);
        if ($checkStmt->fetch()) {
            throw new Exception("A doctor with this email already exists.");
        }

        $query = "INSERT INTO doctors (first_name, last_name, email, phone, specialization) 
                  VALUES (:first_name, :last_name, :email, :phone, :specialization)";
        
        $stmt = $this->db->prepare($query);
        $stmt->execute([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email,
            'phone' => $phone,
            'specialization' => $specialization
        ]);

        return (int)$this->db->lastInsertId();
    }
}
