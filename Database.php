<?php
require_once __DIR__ . '/config.php';

class Database {
    private string $host;
    private string $dbName;
    private string $username;
    private string $password;
    private string $charset = 'utf8mb4';
    private ?PDO $pdo = null;

    public function __construct() {
        $this->host = DB_HOST;
        $this->dbName = DB_NAME;
        $this->username = DB_USER;
        $this->password = DB_PASS;
    }

    /**
     * Get the PDO database connection.
     * 
     * @return PDO
     * @throws Exception
     */
    public function getConnection(): PDO {
        if ($this->pdo !== null) {
            return $this->pdo;
        }

        $dsn = "mysql:host={$this->host};dbname={$this->dbName};charset={$this->charset}";
        
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION, // Throw PDOException on errors
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,       // Return rows as associative arrays
            PDO::ATTR_EMULATE_PREPARES   => false,                  // Use native prepared statements (SQLi defense)
        ];

        try {
            $this->pdo = new PDO($dsn, $this->username, $this->password, $options);
            return $this->pdo;
        } catch (PDOException $e) {
            // Log connection error safely on the server and throw a generic user message
            error_log("Database Connection Failure: " . $e->getMessage());
            throw new Exception("Database connection failed. Please ensure the server and database are running.");
        }
    }
}
