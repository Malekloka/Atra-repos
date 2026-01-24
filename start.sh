#!/bin/bash

echo "Starting both servers..."
echo ""
echo "Starting play-with-dreams server (port 9000)..."
cd play-with-dreams
node server.js &
SERVER1_PID=$!
cd ..

sleep 2

echo "Starting atra server (port 8000)..."
cd atra
node server.js &
SERVER2_PID=$!
cd ..

echo ""
echo "Both servers are running!"
echo "- Homepage: http://localhost:8000/"
echo "- Dream Map: http://localhost:9000/map"
echo ""
echo "Press Ctrl+C to stop both servers..."

# Wait for user interrupt
trap "kill $SERVER1_PID $SERVER2_PID 2>/dev/null; exit" INT TERM
wait

