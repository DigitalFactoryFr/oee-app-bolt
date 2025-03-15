require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method not allowed" };
    }

    // ►►► On récupère machineCount du body
    const { machineCount } = JSON.parse(event.body);

    if (!machineCount || machineCount < 1) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: "Invalid machine count" }) 
      };
    }

    // Prix unitaire : 39€ => 3900 centimes
    const unitAmount = 3900;

    // Créer la session de checkout (mode subscription)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Pilot Pro Subscription',
              // ►►► On précise dans la description le nb de machines
              description: `${machineCount} machine(s) × 39€/month`,
            },
            unit_amount: unitAmount,
            recurring: {
              interval: 'month',
            },
          },
          quantity: machineCount,
        },
      ],
      success_url: `${process.env.SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/cancel`,
      // ►►► On stocke la valeur de machineCount dans metadata
      metadata: {
        machineCount: machineCount.toString(),
      },
    });

    return { 
      statusCode: 200, 
      body: JSON.stringify({ id: session.id }) 
    };
  } catch (error) {
    console.error("Stripe error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
