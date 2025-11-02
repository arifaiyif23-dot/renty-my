import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const OnboardingGuide = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const renterSteps = [
    { step: 1, title: "Create Account", description: "Sign up in 30 seconds", completed: !!user },
    { step: 2, title: "Verify ID", description: "Upload MyKad for trust", completed: false },
    { step: 3, title: "Browse Items", description: "Find what you need", completed: false },
    { step: 4, title: "Book & Pay", description: "Instant confirmation", completed: false },
  ];

  const ownerSteps = [
    { step: 1, title: "Create Account", description: "Join the platform", completed: !!user },
    { step: 2, title: "Verify ID", description: "Build trust with renters", completed: false },
    { step: 3, title: "List Item", description: "Add photos & details", completed: false },
    { step: 4, title: "Start Earning", description: "Get paid automatically", completed: false },
  ];

  return (
    <section className="py-16 md:py-20 bg-card">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
            Get Started in Minutes
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Simple onboarding for renters and owners
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* For Renters */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <Card className="glass-card p-8 h-full">
              <h3 className="font-heading text-2xl font-bold mb-6 text-primary">
                👤 For Renters
              </h3>
              <div className="space-y-4 mb-6">
                {renterSteps.map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${item.completed ? 'bg-primary' : 'bg-muted'}`}>
                      {item.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      ) : (
                        <span className="text-xs font-bold text-muted-foreground">{item.step}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">{item.title}</h4>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button 
                className="w-full" 
                onClick={() => user ? navigate('/search') : navigate('/auth')}
              >
                {user ? 'Start Browsing' : 'Sign Up as Renter'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Card>
          </motion.div>

          {/* For Owners */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <Card className="glass-card p-8 h-full border-primary/50">
              <h3 className="font-heading text-2xl font-bold mb-6 text-primary">
                💰 For Owners
              </h3>
              <div className="space-y-4 mb-6">
                {ownerSteps.map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${item.completed ? 'bg-primary' : 'bg-muted'}`}>
                      {item.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      ) : (
                        <span className="text-xs font-bold text-muted-foreground">{item.step}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">{item.title}</h4>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button 
                variant="secondary" 
                className="w-full"
                onClick={() => user ? navigate('/list-item') : navigate('/auth')}
              >
                {user ? 'List Your First Item' : 'Sign Up as Owner'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-3">
                💡 Average owners earn RM 500/month
              </p>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
