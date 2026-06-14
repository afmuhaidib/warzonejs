Run the game locally on port 8000.

```bash
pkill -f "http.server 8000" 2>/dev/null; python3 -m http.server 8000 &
sleep 1 && open http://localhost:8000
```

ES modules require an HTTP origin — never open index.html directly.
