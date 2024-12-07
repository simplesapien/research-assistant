#!/bin/bash

# Open a new terminal window and run backend
osascript -e 'tell app "Terminal" to do script "cd '"$PWD"'/backend && npm run dev"'

# Open another terminal window and run frontend
osascript -e 'tell app "Terminal" to do script "cd '"$PWD"'/frontend && npm run dev"' 