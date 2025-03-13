require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method not allowed" };
    }

    const { sessionId } = JSON.parse(event.body);
    if (!sessionId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: "Session ID required" }) 
      };
    }

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer']
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        subscription: session.subscription,
        customer: session.customer
      })
    };
  } catch (error) {
    console.error("Stripe error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};