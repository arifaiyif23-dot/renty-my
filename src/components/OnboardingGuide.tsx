import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useInView } from "react-intersection-observer";

export const OnboardingGuide = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  const steps = [
    { 
      step: 1, 
      title: "Create Account", 
      description: "Sign up in 30 seconds. One account for everything.", 
      completed: !!user 
    },
    { 
      step: 2, 
      title: "Verify Your ID", 
      description: "Upload MyKad to build trust in the community", 
      completed: false 
    },
    { 
      step: 3, 
      title: "Browse & List", 
      description: "Rent what you need or list items to earn", 
      completed: false 
    },
    { 
      step: 4, 
      title: "Start Using RENTY", 
      description: "Book instantly, earn automatically, all in one platform", 
      completed: false 
    },
  ];

  return (
    <section ref={ref} className="py-16 md:py-20 bg-card">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-12 ${inView ? 'animate-fade-in' : 'opacity-0'}`}>
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
            Get Started in Minutes
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            One account to rent items and earn from what you own
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className={inView ? 'animate-fade-in' : 'opacity-0'} style={{ animationDelay: '0.2s' }}>
            <Card className="glass-card p-8 md:p-12">
              {/* Steps */}
              <div className="space-y-6 mb-8">
                {steps.map((item, index) => (
                  <div key={item.step} className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${item.completed ? 'bg-primary' : 'bg-muted'}`}>
                      {item.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : (
                        <span className="text-sm font-bold text-muted-foreground">{item.step}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-base mb-1">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="space-y-4">
                {!user ? (
                  <div className="space-y-3">
                    <Button 
                      size="lg"
                      className="w-full" 
                      onClick={() => navigate('/auth')}
                    >
                      Get Started Now
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      Join 1,200+ users on Malaysia's trusted rental platform
                    </p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    <Button 
                      size="lg"
                      onClick={() => navigate('/search')}
                    >
                      Browse Items
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                    <Button 
                      size="lg"
                      variant="secondary"
                      onClick={() => navigate('/list-item')}
                    >
                      List an Item
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Benefits */}
              <div className="mt-8 pt-8 border-t border-border">
                <div className="grid md:grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary mb-1">👤</div>
                    <p className="text-xs text-muted-foreground">One account for both renting & listing</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary mb-1">🛡️</div>
                    <p className="text-xs text-muted-foreground">Fully insured & verified users</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary mb-1">💰</div>
                    <p className="text-xs text-muted-foreground">Avg. users earn RM 500/month</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};
