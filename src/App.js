import React, { useState, useEffect } from 'react';
import { Users, Sword, Shield, Trophy, Plus, Edit, Save, Trash2, Eye, EyeOff, LogOut } from 'lucide-react';
import { supabase } from './supabaseClient';

const CrusadeCampaignApp = () => {
  //Define global admins
  const ADMIN_EMAILS = ['njhartfo@gmail.com'];
  
  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState('login');
  
  // Form states
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  
  // App data states
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [crusadeForces, setCrusadeForces] = useState([]);
  const [units, setUnits] = useState([]);
  
  // Modal states
  const [editingForce, setEditingForce] = useState(null);
  const [editingUnit, setEditingUnit] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ name: '', description: '' });

  // Available factions organized by allegiance
  const factions = {
    Imperium: [
      'Adepta Sororitas',
      'Adeptus Custodes',
      'Adeptus Mechanicus', 
      'Astra Militarum',
      'Deathwatch',
      'Grey Knights',
      'Imperial Agents',
      'Imperial Knights',
      'Space Marines'
    ],
    Chaos: [
      'Chaos Daemons',
      'Chaos Knights',
      'Chaos Space Marines',
      'Death Guard',
      'Emporers Children',
      'Thousand Sons',
      'World Eaters'
    ],
    Xenos: [
      'Aeldari',
      'Drukhari',
      'Genestealer Cults',
      'Leagues of Votann',
      'Necrons',
      'Orks',
      'Tau Empire',
      'Tyranids'
    ]
  };

  // Check if current user is a global admin
  const isGlobalAdmin = () => {
    return user && ADMIN_EMAILS.includes(user.email);
  }

  // Initialize auth state
  // Initialize auth state
  useEffect(() => {
    checkUser();
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    setUser(session?.user ?? null);
    setAuthLoading(false);
    if (session?.user) {
      setCurrentView('dashboard');
      loadUserData();
    } else {
      setCurrentView('login');
      // Clear data when logging out
      setCampaigns([]);
      setCrusadeForces([]);
      setUnits([]);
    }
  });

  return () => subscription.unsubscribe();
}, []);

// Add this new useEffect to load data when user changes
  useEffect(() => {
    if (user && currentView === 'dashboard') {
      loadUserData();
    }
  }, [user, currentView]);

  const checkUser = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (user) {
      setCurrentView('dashboard');
      // Load data immediately when user is found
      await loadUserData();
    }
  } catch (error) {
    console.error('Error checking user:', error);
  } finally {
    setAuthLoading(false);
  }
};

  const loadUserData = async () => {
    if (!user) return;
    
    try {
      // Load campaigns with simplified member data
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select(`
          *,
          campaign_members (
            user_id,
            faction,
            username
          )
        `);

      if (campaignError) throw campaignError;
      setCampaigns(campaignData || []);

      // Load crusade forces
      const { data: forceData, error: forceError } = await supabase
        .from('crusade_forces')
        .select('*');

      if (forceError) throw forceError;
      setCrusadeForces(forceData || []);

      // Load units
      const { data: unitData, error: unitError } = await supabase
        .from('units')
        .select('*');

      if (unitError) throw unitError;
      setUnits(unitData || []);

    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Authentication functions
  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      alert('Please enter email and password');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginForm.email,
        password: loginForm.password
      });

      if (error) throw error;
      
      setLoginForm({ email: '', password: '' });
    } catch (error) {
      alert('Error logging in: ' + error.message);
    }
  };

  const handleRegister = async () => {
    if (!registerForm.username || !registerForm.email || !registerForm.password || !registerForm.confirmPassword) {
      alert('Please fill in all fields');
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: registerForm.email,
        password: registerForm.password,
        options: {
          data: {
            username: registerForm.username
          }
        }
      });

      if (error) throw error;
      
      alert('Registration successful! Please check your email for verification.');
      setRegisterForm({ username: '', email: '', password: '', confirmPassword: '' });
      setCurrentView('login');
    } catch (error) {
      alert('Error registering: ' + error.message);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setCurrentView('login');
      setSelectedCampaign(null);
      setCampaigns([]);
      setCrusadeForces([]);
      setUnits([]);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Campaign functions
  const createCampaign = async () => {
    if (!campaignForm.name || !campaignForm.description) {
      alert('Please fill in campaign name and description');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('campaigns')
        .insert([{
          name: campaignForm.name,
          description: campaignForm.description,
          admin_id: user.id
        }])
        .select();

      if (error) throw error;

      // Add creator as member with username
      await supabase
        .from('campaign_members')
        .insert([{
          campaign_id: data[0].id,
          user_id: user.id,
          faction: 'Space Marines',
          username: user.user_metadata?.username || user.email.split('@')[0]
        }]);

      setCampaignForm({ name: '', description: '' });
      setCreatingCampaign(false);
      loadUserData(); // Refresh data
    } catch (error) {
      alert('Error creating campaign: ' + error.message);
    }
  };

  const joinCampaign = async (campaignId, faction) => {
    try {
      const { error } = await supabase
        .from('campaign_members')
        .insert([{
          campaign_id: campaignId,
          user_id: user.id,
          faction,
          username: user.user_metadata?.username || user.email.split('@')[0]
        }]);

      if (error) throw error;
      loadUserData(); // Refresh data
    } catch (error) {
      alert('Error joining campaign: ' + error.message);
    }
  };

  const deleteCampaign = async (campaignId) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;
      loadUserData(); // Refresh data
    } catch (error) {
      alert('Error deleting campaign: ' + error.message);
    }
  };

  // Crusade Force functions
  const saveCrusadeForce = async (force) => {
    try {
      if (editingForce && editingForce.id) {
        // Update existing force
        const { error } = await supabase
          .from('crusade_forces')
          .update(force)
          .eq('id', editingForce.id);

        if (error) throw error;
      } else {
        // Create new force
        const { error } = await supabase
          .from('crusade_forces')
          .insert([{
            ...force,
            campaign_id: selectedCampaign.id,
            user_id: user.id
          }]);

        if (error) throw error;
      }

      setEditingForce(null);
      loadUserData(); // Refresh data
    } catch (error) {
      alert('Error saving force: ' + error.message);
    }
  };

  const requestDeleteCrusadeForce = (force) => {
    setConfirmDelete({ type: 'force', id: force.id, name: force.name });
  };

  const deleteCrusadeForce = async (forceId) => {
    try {
      const { error } = await supabase
        .from('crusade_forces')
        .delete()
        .eq('id', forceId);

      if (error) throw error;

      setConfirmDelete(null);
      loadUserData(); // Refresh data
    } catch (error) {
      alert('Error deleting force: ' + error.message);
    }
  };

  // Unit functions
  const saveUnit = async (unit) => {
    try {
      if (editingUnit && editingUnit.id) {
        // Update existing unit
        const { error } = await supabase
          .from('units')
          .update(unit)
          .eq('id', editingUnit.id);

        if (error) throw error;
      } else {
        // Create new unit
        const { error } = await supabase
          .from('units')
          .insert([{
            ...unit,
            crusade_force_id: editingUnit.crusade_force_id || editingUnit.crusadeForceId  // Fixed line
          }]);

        if (error) throw error;
      }

      setEditingUnit(null);
      loadUserData(); // Refresh data
    } catch (error) {
      alert('Error saving unit: ' + error.message);
    }
  };

  const requestDeleteUnit = (unit) => {
    setConfirmDelete({ type: 'unit', id: unit.id, name: unit.name });
  };

  const deleteUnit = async (unitId) => {
    try {
      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', unitId);

      if (error) throw error;

      setConfirmDelete(null);
      loadUserData(); // Refresh data
    } catch (error) {
      alert('Error deleting unit: ' + error.message);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-400 mx-auto mb-4"></div>
          <p className="text-xl">Loading Crusade Data...</p>
        </div>
      </div>
    );
  }

  // Login/Register View
  if (currentView === 'login' || currentView === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-gray-900 to-black text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 text-red-400">⚔️ Crusade Campaign Manager</h1>
            <p className="text-gray-300">Track your Warhammer 40k Crusade forces and campaigns</p>
            <p className="text-sm text-yellow-400 mt-2">Powered by Supabase - Real-time multiplayer!</p>
          </div>
          
          <div className="max-w-md mx-auto bg-gray-800 rounded-lg p-6 shadow-lg">
            <div className="flex mb-6">
              <button 
                onClick={() => setCurrentView('login')}
                className={`flex-1 py-2 px-4 rounded-l-lg ${currentView === 'login' ? 'bg-red-600' : 'bg-gray-700'}`}
              >
                Login
              </button>
              <button 
                onClick={() => setCurrentView('register')}
                className={`flex-1 py-2 px-4 rounded-r-lg ${currentView === 'register' ? 'bg-red-600' : 'bg-gray-700'}`}
              >
                Register
              </button>
            </div>

            {currentView === 'login' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500 pr-10"
                      onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button onClick={handleLogin} className="w-full bg-red-600 hover:bg-red-700 py-2 px-4 rounded-lg font-medium">
                  Login
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Username</label>
                  <input
                    type="text"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({...registerForm, confirmPassword: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <button onClick={handleRegister} className="w-full bg-red-600 hover:bg-red-700 py-2 px-4 rounded-lg font-medium">
                  Register
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main Dashboard
  if (currentView === 'dashboard') {
    const allCampaigns = campaigns;

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-gray-900 to-black text-white">
        <nav className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold text-red-400">⚔️ Crusade Campaign Manager</h1>
            <div className="flex items-center space-x-4">
              <span>Welcome, {user.user_metadata?.username || user.email}</span>
              <button onClick={logout} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center">
                <LogOut className="mr-2" size={16} />
                Logout
              </button>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-8">
          {isGlobalAdmin() && (
            <div className="mb-6">
              <button 
                onClick={() => setCreatingCampaign(true)}
                className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-medium flex items-center"
              >
                <Plus className="mr-2" size={20} />
                Create New Campaign
              </button>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-gray-800 rounded-lg p-6 shadow-lg">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <Users className="mr-2" /> Campaigns
              </h2>
              {allCampaigns.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No campaigns available yet.</p>
              ) : (
                allCampaigns.map(campaign => {
                  const isAdmin = campaign.admin_id === user.id;
                  const isMember = campaign.campaign_members?.some(m => m.user_id === user.id);
                  
                  return (
                    <div key={campaign.id} className="border border-gray-600 rounded-lg p-4 mb-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-lg flex items-center">
                            {campaign.name}
                            {isGlobalAdmin && <span className="ml-2 text-xs bg-yellow-600 px-2 py-1 rounded">ADMIN</span>}
                          </h3>
                          <p className="text-gray-300">{campaign.description}</p>
                        </div>
                        {isGlobalAdmin && (
                          <button 
                            onClick={() => deleteCampaign(campaign.id)}
                            className="text-red-400 hover:text-red-300"
                            title="Delete Campaign"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-sm text-gray-400 mb-2">
                          Members ({campaign.campaign_members?.length || 0}):
                        </p>
                        {campaign.campaign_members?.length > 0 ? (
                          <div className="space-y-1">
                            {campaign.campaign_members.map((member, index) => (
                              <div key={`${member.user_id}-${index}`} className="flex justify-between items-center text-sm bg-gray-700 rounded px-3 py-1">
                                <span>{member.username || 'Unknown'} ({member.faction})</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm">No members yet</p>
                        )}
                      </div>
                      
                      {isMember ? (
                        <button 
                          onClick={() => {
                            setSelectedCampaign(campaign);
                            setCurrentView('campaign');
                          }}
                          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
                        >
                          Enter Campaign
                        </button>
                      ) : (
                        <div className="flex space-x-2">
                          <select 
                            id={`faction-${campaign.id}`}
                            className="flex-1 bg-gray-700 rounded-lg px-3 py-2"
                            defaultValue=""
                          >
                            <option value="" disabled>Select Faction</option>
                            <optgroup label="🛡️ Imperium">
                              {factions.Imperium.map(faction => (
                                <option key={faction} value={faction}>{faction}</option>
                              ))}
                            </optgroup>
                            <optgroup label="⚡ Chaos">
                              {factions.Chaos.map(faction => (
                                <option key={faction} value={faction}>{faction}</option>
                              ))}
                            </optgroup>
                            <optgroup label="👽 Xenos">
                              {factions.Xenos.map(faction => (
                                <option key={faction} value={faction}>{faction}</option>
                              ))}
                            </optgroup>
                          </select>
                          <button 
                            onClick={() => {
                              const faction = document.getElementById(`faction-${campaign.id}`).value;
                              if (faction) {
                                joinCampaign(campaign.id, faction);
                              }
                            }}
                            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg"
                          >
                            Join
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <Trophy className="mr-2" /> Your Stats
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                  <span>Campaigns Created</span>
                  <span className="font-bold text-yellow-400">
                    {campaigns.filter(c => c.admin_id === user.id).length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                  <span>Campaigns Joined</span>
                  <span className="font-bold text-green-400">
                    {campaigns.filter(c => c.campaign_members?.some(m => m.user_id === user.id)).length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                  <span>Total Crusade Forces</span>
                  <span className="font-bold text-red-400">
                    {crusadeForces.filter(f => f.user_id === user.id).length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                  <span>Total Units</span>
                  <span className="font-bold text-blue-400">
                    {units.filter(u => {
                      const force = crusadeForces.find(f => f.id === u.crusade_force_id);
                      return force && force.user_id === user.id;
                    }).length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Campaign Creation Modal */}
          {creatingCampaign && isGlobalAdmin && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-bold mb-4 text-green-400 flex items-center">
                  <Plus className="mr-2" size={20} />
                  Create New Campaign
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Campaign Name</label>
                    <input
                      type="text"
                      value={campaignForm.name}
                      onChange={(e) => setCampaignForm({...campaignForm, name: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="The Great Crusade"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <textarea
                      value={campaignForm.description}
                      onChange={(e) => setCampaignForm({...campaignForm, description: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 h-24"
                      placeholder="A campaign of epic battles across the galaxy..."
                    />
                  </div>
                </div>
                <div className="flex space-x-4 pt-4 mt-6 border-t border-gray-600">
                  <button 
                    onClick={createCampaign}
                    className="flex-1 bg-green-600 hover:bg-green-700 py-2 px-4 rounded-lg font-medium flex items-center justify-center"
                  >
                    <Save className="mr-2" size={16} />
                    Create Campaign
                  </button>
                  <button 
                    onClick={() => {
                      setCreatingCampaign(false);
                      setCampaignForm({ name: '', description: '' });
                    }}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 py-2 px-4 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Campaign View - COMPLETE VERSION
  if (currentView === 'campaign' && selectedCampaign) {
    const campaignCrusadeForces = crusadeForces.filter(f => 
      f.campaign_id === selectedCampaign.id
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-gray-900 to-black text-white">
        <nav className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="container mx-auto flex justify-between items-center">
            <div>
              <button 
                onClick={() => setCurrentView('dashboard')}
                className="text-red-400 hover:text-red-300 mr-4"
              >
                ← Back
              </button>
              <span className="text-2xl font-bold">{selectedCampaign.name}</span>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => setEditingForce({ campaign_id: selectedCampaign.id, user_id: user.id })}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center"
              >
                <Plus className="mr-1" size={16} /> New Crusade Force
              </button>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-8">
          {campaignCrusadeForces.length === 0 ? (
            <div className="text-center py-12">
              <Sword className="mx-auto mb-4 text-gray-500" size={64} />
              <p className="text-xl text-gray-400 mb-4">No Crusade Forces yet</p>
              <button 
                onClick={() => setEditingForce({ campaign_id: selectedCampaign.id, user_id: user.id })}
                className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg"
              >
                Create Your First Crusade Force
              </button>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-6">
              {campaignCrusadeForces.map(force => (
                <CrusadeForceCard 
                  key={force.id} 
                  force={force} 
                  units={units.filter(u => u.crusade_force_id === force.id)}
                  onEdit={() => setEditingForce(force)}
                  onDelete={() => requestDeleteCrusadeForce(force)}
                  onAddUnit={() => setEditingUnit({ crusade_force_id: force.id })}
                  onEditUnit={(unit) => setEditingUnit(unit)}
                  onDeleteUnit={(unit) => requestDeleteUnit(unit)}
                  currentUser={user}
                  campaignMembers={selectedCampaign.campaign_members}
                />
              ))}
            </div>
          )}

          {/* Crusade Force Form Modal */}
          {editingForce && (
            <CrusadeForceForm 
              force={editingForce} 
              onSave={saveCrusadeForce} 
              onCancel={() => setEditingForce(null)}
              factions={factions}
            />
          )}

          {/* Unit Form Modal */}
          {editingUnit && (
            <UnitForm 
              unit={editingUnit} 
              onSave={saveUnit} 
              onCancel={() => setEditingUnit(null)}
            />
          )}

          {/* Delete Confirmation Modal */}
          {confirmDelete && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-2xl border border-red-500">
                <h3 className="text-xl font-bold mb-4 text-red-400 flex items-center">
                  <Trash2 className="mr-2" size={20} />
                  Confirm Deletion
                </h3>
                <p className="text-gray-300 mb-6">
                  Are you sure you want to delete {confirmDelete.type === 'force' ? 'Crusade Force' : 'Unit'} 
                  <span className="font-bold text-white"> "{confirmDelete.name}"</span>?
                  {confirmDelete.type === 'force' && (
                    <span className="block mt-2 text-red-300 text-sm">
                      ⚠️ This will also delete all units in this force!
                    </span>
                  )}
                </p>
                <div className="flex space-x-4">
                  <button 
                    onClick={() => {
                      if (confirmDelete.type === 'force') {
                        deleteCrusadeForce(confirmDelete.id);
                      } else {
                        deleteUnit(confirmDelete.id);
                      }
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-700 py-2 px-4 rounded-lg font-medium flex items-center justify-center"
                  >
                    <Trash2 className="mr-2" size={16} />
                    Delete
                  </button>
                  <button 
                    onClick={() => setConfirmDelete(null)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 py-2 px-4 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

// Crusade Force Card Component
const CrusadeForceCard = ({ force, units, onEdit, onDelete, onAddUnit, onEditUnit, onDeleteUnit, currentUser, campaignMembers }) => {
  const totalPoints = units.reduce((sum, unit) => sum + (unit.points_cost || 0), 0);
  const totalCrusadePoints = units.reduce((sum, unit) => sum + (unit.crusade_points || 0), 0);
  
  // Find the owner's username
  const owner = campaignMembers?.find(member => member.user_id === force.user_id);
  const isOwnForce = currentUser.id === force.user_id;

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-600">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-red-400">{force.name}</h3>
          <p className="text-gray-300">{force.faction}</p>
          <p className="text-sm text-yellow-400">
            {isOwnForce ? 'Your Force' : `${owner?.username || 'Unknown Player'}'s Force`}
          </p>
        </div>
        {isOwnForce && (
          <div className="flex space-x-2">
            <button onClick={onEdit} className="text-blue-400 hover:text-blue-300">
              <Edit size={16} />
            </button>
            <button onClick={onDelete} className="text-red-400 hover:text-red-300">
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 bg-gray-700 rounded-lg">
          <div className="text-2xl font-bold text-blue-400">{force.battle_tally || 0}</div>
          <div className="text-sm text-gray-400">Battle Tally</div>
        </div>
        <div className="text-center p-3 bg-gray-700 rounded-lg">
          <div className="text-2xl font-bold text-green-400">{force.victories || 0}</div>
          <div className="text-sm text-gray-400">Victories</div>
        </div>
        <div className="text-center p-3 bg-gray-700 rounded-lg">
          <div className="text-2xl font-bold text-yellow-400">{force.requisition_points || 0}</div>
          <div className="text-sm text-gray-400">Req. Points</div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4 text-sm">
        <span>Supply: {totalPoints} / {force.supply_limit || 50}</span>
        <span>Crusade Points: {totalCrusadePoints}</span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-semibold">Units ({units.length})</h4>
          {isOwnForce && (
            <button 
              onClick={onAddUnit}
              className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm flex items-center"
            >
              <Plus size={12} className="mr-1" /> Add Unit
            </button>
          )}
        </div>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {units.map(unit => (
            <div key={unit.id} className="flex justify-between items-center bg-gray-700 rounded px-3 py-2 text-sm">
              <span>{unit.name}</span>
              <div className="flex items-center space-x-2">
                <span>{unit.points_cost || 0}pts</span>
                {isOwnForce && (
                  <>
                    <button onClick={() => onEditUnit(unit)} className="text-blue-400 hover:text-blue-300">
                      <Edit size={12} />
                    </button>
                    <button onClick={() => onDeleteUnit(unit)} className="text-red-400 hover:text-red-300">
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {force.record_of_achievement && (
        <div className="bg-gray-700 rounded p-3">
          <h4 className="font-semibold mb-2">Record of Achievement</h4>
          <p className="text-sm text-gray-300">{force.record_of_achievement}</p>
        </div>
      )}
    </div>
  );
};

// Crusade Force Form Component
const CrusadeForceForm = ({ force, onSave, onCancel, factions }) => {
  const [formData, setFormData] = useState({
    name: force.name || '',
    faction: force.faction || '',
    supply_limit: force.supply_limit || 50,
    battle_tally: force.battle_tally || 0,
    victories: force.victories || 0,
    requisition_points: force.requisition_points || 0,
    record_of_achievement: force.record_of_achievement || '',
    ...force
  });

  const handleSubmit = () => {
    if (!formData.name || !formData.faction) {
      alert('Please fill in required fields');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-red-400">
          {force.id ? 'Edit Crusade Force' : 'New Crusade Force'}
        </h2>
        
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Force Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Faction</label>
              <select
                value={formData.faction}
                onChange={(e) => setFormData({...formData, faction: e.target.value})}
                className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select Faction</option>
                <optgroup label="🛡️ Imperium">
                  {factions.Imperium.map(faction => (
                    <option key={faction} value={faction}>{faction}</option>
                  ))}
                </optgroup>
                <optgroup label="⚡ Chaos">
                  {factions.Chaos.map(faction => (
                    <option key={faction} value={faction}>{faction}</option>
                  ))}
                </optgroup>
                <optgroup label="👽 Xenos">
                  {factions.Xenos.map(faction => (
                    <option key={faction} value={faction}>{faction}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Supply Limit</label>
              <input
                type="number"
                value={formData.supply_limit}
                onChange={(e) => setFormData({...formData, supply_limit: parseInt(e.target.value)})}
                className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Battle Tally</label>
              <input
                type="number"
                value={formData.battle_tally}
                onChange={(e) => setFormData({...formData, battle_tally: parseInt(e.target.value)})}
                className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Victories</label>
              <input
                type="number"
                value={formData.victories}
                onChange={(e) => setFormData({...formData, victories: parseInt(e.target.value)})}
                className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Requisition Points</label>
            <input
              type="number"
              value={formData.requisition_points}
              onChange={(e) => setFormData({...formData, requisition_points: parseInt(e.target.value)})}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Record of Achievement</label>
            <textarea
              value={formData.record_of_achievement}
              onChange={(e) => setFormData({...formData, record_of_achievement: e.target.value})}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500 h-24"
              placeholder="Notable battles, honors, and achievements..."
            />
          </div>

          <div className="flex space-x-4 pt-4">
            <button 
              onClick={handleSubmit}
              className="flex-1 bg-green-600 hover:bg-green-700 py-2 px-4 rounded-lg font-medium flex items-center justify-center"
            >
              <Save className="mr-2" size={16} />
              Save Force
            </button>
            <button 
              onClick={onCancel}
              className="flex-1 bg-gray-600 hover:bg-gray-700 py-2 px-4 rounded-lg font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Unit Form Component
const UnitForm = ({ unit, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: unit.name || '',
    unit_type: unit.unit_type || '',
    sub_faction_keywords: unit.sub_faction_keywords || '',
    points_cost: unit.points_cost || 0,
    crusade_points: unit.crusade_points || 0,
    equipment: unit.equipment || '',
    enhancements: unit.enhancements || '',
    battles_played: unit.battles_played || 0,
    battles_survived: unit.battles_survived || 0,
    enemy_units_destroyed: unit.enemy_units_destroyed || 0,
    battle_honours: unit.battle_honours || '',
    battle_scars: unit.battle_scars || '',
    ...unit
  });

  const handleSubmit = () => {
    if (!formData.name) {
      alert('Please enter a unit name');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl my-4 shadow-2xl">
        <h2 className="text-2xl font-bold mb-6 text-red-400 sticky top-0 bg-gray-800 pb-2 border-b border-gray-600">
          {unit.id ? 'Edit Unit' : 'New Unit'}
        </h2>
        
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Unit Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Points Cost</label>
                  <input
                    type="number"
                    value={formData.points_cost}
                    onChange={(e) => setFormData({...formData, points_cost: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Crusade Points</label>
                  <input
                    type="number"
                    value={formData.crusade_points}
                    onChange={(e) => setFormData({...formData, crusade_points: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Unit Type</label>
                <input
                  type="text"
                  value={formData.unit_type}
                  onChange={(e) => setFormData({...formData, unit_type: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="e.g., Troops, Elite, HQ"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Sub-Faction Keywords</label>
                <input
                  type="text"
                  value={formData.sub_faction_keywords}
                  onChange={(e) => setFormData({...formData, sub_faction_keywords: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="e.g., ULTRAMARINES, BLOOD ANGELS"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Equipment</label>
                <textarea
                  value={formData.equipment}
                  onChange={(e) => setFormData({...formData, equipment: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500 h-20"
                  placeholder="Weapons, wargear, and equipment..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Enhancements & Upgrades</label>
                <textarea
                  value={formData.enhancements}
                  onChange={(e) => setFormData({...formData, enhancements: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500 h-20"
                  placeholder="Special upgrades and enhancements..."
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="font-semibold mb-3 text-yellow-400">Combat Tallies</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Battles Played</label>
                    <input
                      type="number"
                      value={formData.battles_played}
                      onChange={(e) => setFormData({...formData, battles_played: parseInt(e.target.value)})}
                      className="w-full px-2 py-1 bg-gray-600 rounded text-sm focus:ring-1 focus:ring-red-500"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Battles Survived</label>
                    <input
                      type="number"
                      value={formData.battles_survived}
                      onChange={(e) => setFormData({...formData, battles_survived: parseInt(e.target.value)})}
                      className="w-full px-2 py-1 bg-gray-600 rounded text-sm focus:ring-1 focus:ring-red-500"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Enemies Destroyed</label>
                    <input
                      type="number"
                      value={formData.enemy_units_destroyed}
                      onChange={(e) => setFormData({...formData, enemy_units_destroyed: parseInt(e.target.value)})}
                      className="w-full px-2 py-1 bg-gray-600 rounded text-sm focus:ring-1 focus:ring-red-500"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-green-400">Battle Honours</label>
                <textarea
                  value={formData.battle_honours}
                  onChange={(e) => setFormData({...formData, battle_honours: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500 h-32"
                  placeholder="Earned battle honours and special abilities..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-red-400">Battle Scars</label>
                <textarea
                  value={formData.battle_scars}
                  onChange={(e) => setFormData({...formData, battle_scars: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500 h-32"
                  placeholder="Battle scars and permanent injuries..."
                />
              </div>
            </div>
          </div>

          <div className="flex space-x-4 pt-4 border-t border-gray-600">
            <button 
              onClick={handleSubmit}
              className="flex-1 bg-green-600 hover:bg-green-700 py-2 px-4 rounded-lg font-medium flex items-center justify-center"
            >
              <Save className="mr-2" size={16} />
              Save Unit
            </button>
            <button 
              onClick={onCancel}
              className="flex-1 bg-gray-600 hover:bg-gray-700 py-2 px-4 rounded-lg font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrusadeCampaignApp;