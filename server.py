from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# CRITICAL: This allows my Next.js site to talk to your Python server without security errors
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# This defines what data Next.js will send you
class IdeaRequest(BaseModel):
    idea: str


@app.post("/api/analyze-idea")
def analyze_idea(request: IdeaRequest):
    user_text = request.idea

    # -----------------------------------------------------
    # YOUR CUSTOM MATH/LOGIC GOES HERE!
    # Take `user_text`, run it through your KNN or TF-IDF,
    # and calculate the predicted funding and funder.
    # -----------------------------------------------------
    _ = user_text
    calculated_amount = 850000  # Replace with your real variable
    top_funder = "NSF"          # Replace with your real variable

    # Send the final data back to the Next.js frontend
    return {
        "amount": calculated_amount,
        "funder": top_funder
    }
