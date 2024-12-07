Backend:
- Organize the code better. 
- API calls + DB calls are very slow. Need to optimize them.
- Insight feedback functions are running numerous times and very slow. 

Vector Search:
- Maybe make dimension smaller if space becomes an issue (will have to use a different embedding model)
- Seems like the same set of tools are being recommended over and over again. Need to add more diversity to the recommendations.
- The threshold never really seems to go above 0.3. Maybe it's not a good idea to use cosine similarity? Or I should explore other vector search methods.
- the 'type' being added to the insights is not working. it's not the same everytime. need to normalize it.

Prompting:
- Need to have the AI assistant give more context about the tools it recommends, and how to use them for that purpose.
- Change the prompt to reflect this sentiment: "don't be general. think sepciically of the user's request and recommend tools accordingly.”
- "What is the most important thing to do RIGHT NOW?"
- Resarch steps that are relevant and specific to the particular user's request and directoin
- Program is forcing responses and handing out tools even when not relevant. 

Tools page:
- Make the "add tool" form look nicer. 
- When editing, be sure the form is prepopulated with the all of the that tool's data. 
- When deleting, have a confirmation prompt. 
- Fix the display of the tools on the page. 

Knowledge page:
- Make sure the correct dates are being added to the insights. 
- When deleting, have a confirmation prompt. 
- Make the insight addition a little less form-like