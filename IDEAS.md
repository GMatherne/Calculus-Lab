Human Ideas:

    Things to Add:

        - Things to memorize section
            - Specific to each level? Grows with each level? By section?
            - Main lesson of each lesson 
                - Laid out concisely in main thing but can have button to give expanded explanation
            - Derivatives of important functions (sin, cos, e^x, etc.)
            - Power rule, etc.

        - Product rule, chain rule, quotient rule, etc.
        
        - Non-polynomial functions

        - Something that easily allows users to practice what is classified as a weak topic for them (in lessons they've already seen)
            - Next to continue lesson button?


    AI Incorporation:

        - AI that allows the user to talk about each answer choice for each question--why something is wrong/right, can have the student walk through how they got an incorrect answer to suggest fixes to the logic
            - I like this one

        - AI generated questions
            - Might not always be correct
            - Compatability with interactive widgets might be difficult

        - AI that connects problems to real world scenarios
          - Can help boost intrinsic understanding


    Learning Science:

        LS Idea: Forcing scaffolds on experts is bad
        Solutions:
            - Take comprehensive test to skip levels
                - Required amount of questions per lesson
                - Ensure all topics in the lessons are represented?

        LS Idea: Dark-pattern streaks are bad
        Solutions:
            - Streak sympathy for newcomers
                - Becomes more rigid as they use the app
            - Streak freezes
            - Brilliant sent me emails a few minutes ago about my streak

        LS Idea: Spaced repetition is good
        Solutions:
            - Take cumulative test required to move to next level
                - Required amount of questions from each lesson or level

        LS Idea: Self-Explanation is good
        Solutions:
            - Chatbot that talks through answer choices and has user explain their thought process might help



AI Ideas (assistant suggestions):

    Framing: these are deliberately different from the two AI ideas above (an answer-choice chatbot + generic question generation). The app already has a deterministic "answer oracle" (checkAnswer, verifyNumericWithMathJs, derivativeAt/riemannSum, assertValidLesson/validateLesson) and a mastery layer (getConceptMastery, getWeakConcepts, stepAttempts/stepAnswers, activityLog). Most ideas below use AI as a *generative front-end* on top of that existing deterministic + data layer, which is what makes them reliable.

    Guiding constraints (apply to every idea):
        - Truth oracle: AI never grades math on its own. Anything it produces or checks is gated by the existing engine (checkAnswer / verifyNumericWithMathJs / derivativeAt / assertValidLesson). This directly fixes your "might not always be correct" worry.
        - Offline-first & instant: client-side grading must keep working with zero AI. Every AI feature degrades to the hand-authored content when offline/over budget, and never blocks the synchronous grade.
        - Delivery: Firebase AI Logic (Gemini) from the browser — no new backend, so the "server-free" architecture stays intact.
        - LS-first: prefer features that create desirable difficulty, retrieval, and self-explanation over ones that just hand out answers.


    1. Generation & authoring  (turns "AI questions" from risky -> reliable)

        - Schema-constrained generation + verifier loop
            - Use Gemini structured output to emit a Step that conforms exactly to the existing AnswerSpec JSON schema (multiple_choice, power_term, drag_drop, riemann, sign_chart, match, ...). Solves your "widget compatibility" risk by construction — it can only emit shapes the widgets already render.
            - Then verify before it's ever shown: run assertValidLesson + checkAnswer, and for math, confirm the claimed answer with the deterministic engine (e.g. derivativeAt() must match the stated power_term; trueArea must match riemannSum()). Reject & regenerate on mismatch. Solves "might not be correct."
            - Net: same idea you listed, but the deterministic layer is the judge, so a bad item can't reach a learner.

        - Lesson authoring copilot (in DevTools, author-time only)
            - From a conceptTag + objective, draft a full 6-10 step lesson (>=1 slider_graph, content blocks, and all three feedback fields), then auto-run `npm run validate:lessons` + the verifier above. Human reviews before publish, preserving your hand-authored quality bar while cutting authoring time. This is the lowest-risk place to start (no live learner exposure).

        - Diagnostic distractor generator
            - Generate wrong multiple_choice / drag_drop bank options that each encode a *named misconception* ("brought the coefficient down but forgot n-1", "differentiated the constant to 1"). Store the misconception tag with the option so a wrong pick can trigger targeted feedback (feeds idea #2).

        - Feedback drafting assistant
            - Draft the correct/incorrect/hint trio for new steps in your house voice (concise, hint never reveals the answer), for a human to edit. Pure authoring aid, no runtime risk.


    2. Adaptive feedback & hints at runtime  (beyond a single chat window)

        - Misconception diagnosis from the *actual* wrong answer
            - You already persist stepAnswers + stepAttempts. Feed the literal wrong value (e.g. power_term {coef:3, exp:3}) to Gemini to name the specific slip ("you brought the 3 down but didn't reduce the exponent"). Far more targeted than a generic "incorrect" string, and grounded because the engine already knows exactly what's wrong. Authored `incorrect` text is the offline fallback.

        - Progressive hint ladder calibrated to mastery
            - Today there's one authored hint after N attempts. Generate a *sequence* (nudge -> strategy -> worked partial) scaled to the learner's tier for that conceptTag (learning vs proficient), still never revealing the final answer (keeps your existing hint rule).

        - Worked-solution-on-demand, but only after mastery is shown
            - Unlock an AI step-by-step walkthrough only after the learner has answered correctly (or exhausted attempts), so it reinforces rather than short-circuits the struggle. Verify each line with math.js before showing.


    3. Generative self-explanation & reasoning checks  (the LS idea you flagged)

        - "Explain why" checkpoint, graded by AI
            - After a correct answer on a keystone step, optionally ask the learner to type *why* in one sentence; AI evaluates the explanation against the concept and responds. This is generative self-explanation (a stronger LS lever than a chatbot), and it grades the learner's *reasoning*, not the answer.

        - Process walkthrough that grades the student's logic
            - Your note "have the student walk through how they got a wrong answer" — make the unit of grading the *reasoning chain*, not the choice. AI asks the learner to state their steps, then pinpoints the first faulty step (cross-checked with derivativeAt/secantSlope where applicable).

        - Socratic tutor (constrained), as a contrast to the open chatbot
            - Same surface as your chatbot, but system-constrained to ask guiding questions and refuse to state the final answer, scoped to calculus only. The constraint is the differentiator and the LS win.


    4. Personalization from your mastery data  (you already compute all of this)

        - AI study plan / weekly coach
            - Read getConceptMastery() + getWeakConcepts() + streak + activityLog and produce a personalized plan ("weakest: chain rule & area-under-curve; here's a 3-day set"). Builds directly on your "practice weak topics" idea and the existing weak-area linking.

        - Adaptive next-question selection (zero generation risk)
            - Use AI only to *sequence/select* from the existing vetted practiceBank / getReviewSession items based on mastery + recent errors + spacing. No new content is generated, so correctness is guaranteed; AI just personalizes order.

        - Natural-language progress summary on /profile
            - Turn the heatmap + ConceptMastery numbers into an encouraging, specific narrative ("mastered the power rule; integrals are next"). Low risk, high delight, uses data you already have.

        - Spaced-repetition scheduler with AI-written rationale
            - Reinforces your spaced-repetition goal: pick *when* a concept resurfaces in mixed review; AI supplies the human-readable "why now."


    5. New input modalities  (multimodal Gemini)

        - Snap-a-problem
            - Photograph a textbook/handwritten problem -> Gemini parses it into an interactive Step (verified by section 1 before it's playable). Great for "bring your homework" practice.

        - Show-your-work / scratchpad checker
            - Let learners enter an intermediate line (not just the boxed answer); AI finds the *first* wrong step, anchored by math.js where the step is checkable. Pairs well with the limit-definition and FTC lessons where process matters.

        - Voice Socratic tutor
            - Hands-free version of the constrained tutor for mobile use.


    Cross-cutting guardrails & rollout
        - Deterministic gate on everything generative (the section-1 verifier is the backbone — it's why "AI questions" become safe).
        - Graceful degradation: offline / over-budget -> fall back to authored content; AI calls are async and never block the instant grade.
        - Safety/cost: Firebase App Check + rate limits, prompt-injection hardening and calculus-only scoping for any free-text surface, log AI outputs for human review.
        - Privacy: send anonymized mastery vectors, not PII; per-user opt-out toggle.
        - Suggested order: start author-time (copilot + verified generation, no learner risk) -> then runtime misconception feedback -> then personalization -> then multimodal.