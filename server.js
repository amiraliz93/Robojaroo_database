// Import necessary modules
// 'express' is a web framework for Node.js
// 'fs' is the built-in file system module
// 'path' is a utility for working with file and directory paths
const express = require('express');
const fs = require('fs');
const path = require('path');

// Initialize the Express app
const app = express();
// Set the port for the server. Use the environment variable or default to 3000.
const PORT = process.env.PORT || 3000;

// This is the main API endpoint that mu.chat will connect to.
// It handles GET requests to the root URL ('/').
app.get('/', (req, res) => {
    // Construct the full path to the data.json file
    const dataPath = path.join(__dirname, 'data.json');

    // Read the JSON data file asynchronously
    fs.readFile(dataPath, 'utf8', (err, data) => {
        // If there's an error reading the file, log it and send a server error response.
        if (err) {
            console.error("Error reading data.json:", err);
            return res.status(500).json({ error: "Internal Server Error: Could not read data file." });
        }

        let items;
        // Try to parse the file content as JSON.
        try {
            items = JSON.parse(data);
        } catch (parseErr) {
            console.error("Error parsing data.json:", parseErr);
            return res.status(500).json({ error: "Internal Server Error: Malformed JSON in data file." });
        }
        

        // --- 1. Filtering (as required by mu.chat docs) ---
        const { modified_after } = req.query;
        if (modified_after) {
            const modifiedAfterDate = new Date(modified_after);
            // Check if the provided date is valid
            if (!isNaN(modifiedAfterDate.getTime())) {
                items = items.filter(item => {
                    const itemDate = new Date(item.date_modified);
                    return itemDate > modifiedAfterDate;
                });
            }
        }

        // --- Get total count AFTER filtering but BEFORE pagination ---
        const total_count = items.length;

        // --- 2. Sorting (as required by mu.chat docs) ---
        // Default to sorting by date_modified in descending order
        const { order_by = 'date_modified', order = 'desc' } = req.query;
        
        items.sort((a, b) => {
            const valA = a[order_by];
            const valB = b[order_by];

            // Handle cases where the property might not exist on an item
            if (valA === undefined || valB === undefined) return 0;

            if (valA < valB) {
                return order === 'asc' ? -1 : 1;
            }
            if (valA > valB) {
                return order === 'asc' ? 1 : -1;
            }
            return 0;
        });

        // --- 3. Pagination (as required by mu.chat docs) ---
        // 'skip' is the offset, 'take' is the limit.
        const skip = parseInt(req.query.skip, 10) || 0;
        const take = parseInt(req.query.take, 10) || 10; // Default to 10 items
        
        const paginatedItems = items.slice(skip, skip + take);

        // --- 4. Final Response Structure (as required by mu.chat docs) ---
        const response = {
            total_count: total_count,
            items: paginatedItems
        };

        // Send the final, correctly formatted JSON response
        res.status(200).json(response);
    });
});

// Start the server and listen for incoming requests on the specified port
app.listen(PORT, () => {
    console.log(`✅ mu.chat compatible server is running on http://localhost:${PORT}`);
    console.log('Test it by opening these URLs in your browser:');
    console.log(`- All items: http://localhost:${PORT}`);
    console.log(`- Paginated: http://localhost:${PORT}/?take=2&skip=2`);
    console.log(`- Sorted by price: http://localhost:${PORT}/?order_by=price&order=asc`);
});